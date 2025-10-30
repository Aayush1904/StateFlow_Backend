import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import {
  createPageVersionService,
  getPageVersionsService,
  getPageVersionByIdService,
  restorePageVersionService,
  comparePageVersionsService,
} from '../services/pageVersion.service';

const workspaceIdSchema = z.string().trim().min(1);
const pageIdSchema = z.string().trim().min(1);
const versionIdSchema = z.string().trim().min(1);

const createVersionSchema = z.object({
  changeDescription: z.string().trim().optional(),
});

export const createPageVersionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const pageId = pageIdSchema.parse(req.params.pageId);
    const body = createVersionSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]); // Using EDIT_TASK permission for now

    const { version } = await createPageVersionService(pageId, userId, body.changeDescription);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Page version created successfully',
      version,
    });
  }
);

export const getPageVersionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const pageId = pageIdSchema.parse(req.params.pageId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { versions } = await getPageVersionsService(pageId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Page versions fetched successfully',
      versions,
    });
  }
);

export const getPageVersionByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const pageId = pageIdSchema.parse(req.params.pageId);
    const versionId = versionIdSchema.parse(req.params.versionId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { version } = await getPageVersionByIdService(versionId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Page version fetched successfully',
      version,
    });
  }
);

export const restorePageVersionController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const pageId = pageIdSchema.parse(req.params.pageId);
    const versionId = versionIdSchema.parse(req.params.versionId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const { page, restoredVersion } = await restorePageVersionService(pageId, versionId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Page version restored successfully',
      page,
      restoredVersion,
    });
  }
);

export const comparePageVersionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const pageId = pageIdSchema.parse(req.params.pageId);
    const versionId1 = versionIdSchema.parse(req.params.versionId1);
    const versionId2 = versionIdSchema.parse(req.params.versionId2);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { version1, version2, titleChanged, contentChanged } = await comparePageVersionsService(versionId1, versionId2);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Page versions compared successfully',
      version1,
      version2,
      titleChanged,
      contentChanged,
    });
  }
);
