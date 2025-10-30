import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import {
  getActivitiesByWorkspaceService,
  getActivityByIdService,
  deleteActivityService,
  ActivityFilters,
} from '../services/activity.service';

const workspaceIdSchema = z.string().trim().min(1);
const activityIdSchema = z.string().trim().min(1);

const getActivitiesSchema = z.object({
  userId: z.string().optional(),
  resourceType: z.enum(['page', 'task', 'project', 'member', 'comment']).optional(),
  projectId: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const getActivitiesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = getActivitiesSchema.parse(req.query);

    // Check if user has access to workspace
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]); // Using VIEW_ONLY permission for now

    const filters: ActivityFilters = {
      userId: query.userId,
      resourceType: query.resourceType,
      projectId: query.projectId,
      type: query.type,
      limit: query.limit,
      offset: query.offset,
    };

    const { activities, totalCount, hasMore } = await getActivitiesByWorkspaceService(
      workspaceId,
      filters
    );

    return res.status(HTTPSTATUS.OK).json({
      message: 'Activities fetched successfully',
      activities,
      pagination: {
        totalCount,
        hasMore,
        limit: query.limit,
        offset: query.offset,
      },
    });
  }
);

export const getActivityByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const activityId = activityIdSchema.parse(req.params.activityId);

    // Check if user has access to workspace
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]); // Using VIEW_ONLY permission for now

    const { activity } = await getActivityByIdService(activityId);

    // Verify activity belongs to the workspace
    if (activity.workspaceId !== workspaceId) {
      return res.status(HTTPSTATUS.FORBIDDEN).json({
        message: 'Access denied',
      });
    }

    return res.status(HTTPSTATUS.OK).json({
      message: 'Activity fetched successfully',
      activity,
    });
  }
);

export const deleteActivityController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const activityId = activityIdSchema.parse(req.params.activityId);

    // Check if user has access to workspace
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_TASK]); // Using DELETE_TASK permission for now

    const { activity } = await deleteActivityService(activityId);

    // Verify activity belongs to the workspace
    if (activity.workspaceId !== workspaceId) {
      return res.status(HTTPSTATUS.FORBIDDEN).json({
        message: 'Access denied',
      });
    }

    return res.status(HTTPSTATUS.OK).json({
      message: 'Activity deleted successfully',
      activity,
    });
  }
);
