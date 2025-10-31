import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import {
  createPageService,
  getPageByIdService,
  getPagesByWorkspaceService,
  updatePageService,
  deletePageService,
} from '../services/page.service';
import { createPageVersionService } from '../services/pageVersion.service';
import { createPageActivity } from '../services/activity.service';
import ProjectModel from '../models/project.model';

const workspaceIdSchema = z.string().trim().min(1);
const pageIdSchema = z.string().trim().min(1);
const projectIdSchema = z.string().trim().min(1).optional();

const createPageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().optional(),
  projectId: z.string().trim().min(1).optional(),
  parentId: z.string().trim().min(1).optional(),
  isPublished: z.boolean().optional(),
  templateId: z
    .union([z.string().trim().min(1), z.undefined()])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
});

const updatePageSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const createPageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = createPageSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_TASK]); // Using CREATE_TASK permission for now

    const { page } = await createPageService(workspaceId, userId, body);

    // Log activity
    try {
      const project = body.projectId ? await ProjectModel.findById(body.projectId) : null;
      await createPageActivity(
        workspaceId,
        userId,
        'page_created',
        page._id,
        page.title,
        body.projectId,
        project?.name || 'No Project'
      );
    } catch (error) {
      console.error('Failed to log page creation activity:', error);
    }

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Page created successfully',
      page,
    });
  }
);

export const getPageByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const pageId = pageIdSchema.parse(req.params.pageId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { page } = await getPageByIdService(pageId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Page fetched successfully',
      page,
    });
  }
);

export const getPagesByWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const projectId = req.query.projectId ? projectIdSchema.parse(req.query.projectId) : undefined;
    const parentId = req.query.parentId as string | undefined;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { pages } = await getPagesByWorkspaceService(workspaceId, projectId, parentId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Pages fetched successfully',
      pages,
    });
  }
);

export const updatePageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const pageId = pageIdSchema.parse(req.params.pageId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = updatePageSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]); // Using EDIT_TASK permission for now

    // Create a version before updating (only if content or title changed)
    const currentPage = await getPageByIdService(pageId);
    const hasSignificantChanges = 
      (body.title && body.title !== currentPage.page.title) ||
      (body.content && body.content !== currentPage.page.content);

    if (hasSignificantChanges) {
      await createPageVersionService(pageId, userId, 'Auto-saved version');
    }

    const { page } = await updatePageService(pageId, userId, body);

    // Log activity
    try {
      const project = page.project?._id ? await ProjectModel.findById(page.project._id) : null;
      await createPageActivity(
        workspaceId,
        userId,
        'page_updated',
        pageId,
        page.title,
        page.project?._id?.toString(),
        project?.name || 'No Project',
        { 
          titleChanged: body.title !== currentPage.page.title,
          contentChanged: body.content !== currentPage.page.content,
          changes: body
        }
      );
    } catch (error) {
      console.error('Failed to log page update activity:', error);
    }

    return res.status(HTTPSTATUS.OK).json({
      message: 'Page updated successfully',
      page,
    });
  }
);

export const deletePageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const pageId = pageIdSchema.parse(req.params.pageId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_TASK]); // Using DELETE_TASK permission for now

    // Get page details before deletion for activity logging
    const currentPage = await getPageByIdService(pageId);

    const { message } = await deletePageService(pageId);

    // Log activity
    try {
      const project = currentPage.page.project?._id ? await ProjectModel.findById(currentPage.page.project._id) : null;
      await createPageActivity(
        workspaceId,
        userId,
        'page_deleted',
        pageId,
        currentPage.page.title,
        currentPage.page.project?._id?.toString(),
        project?.name || 'No Project'
      );
    } catch (error) {
      console.error('Failed to log page deletion activity:', error);
    }

    return res.status(HTTPSTATUS.OK).json({
      message,
    });
  }
);
