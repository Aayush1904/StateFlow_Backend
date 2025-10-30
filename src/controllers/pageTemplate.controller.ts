import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import {
  createTemplateService,
  getTemplateByIdService,
  getTemplatesByWorkspaceService,
  updateTemplateService,
  deleteTemplateService,
  seedDefaultTemplatesService,
} from '../services/pageTemplate.service';

const workspaceIdSchema = z.string().trim().min(1);
const templateIdSchema = z.string().trim().min(1);

const categorySchema = z.enum(['meeting-notes', 'sprint-retro', 'project-plan', 'daily-standup', 'custom', 'other']);

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional(),
  content: z.string().min(1),
  category: categorySchema,
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(500).optional(),
  content: z.string().optional(),
  category: categorySchema.optional(),
});

export const createTemplateController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = req.params.workspaceId;

    const body = createTemplateSchema.parse(req.body);

    // If workspaceId is provided, verify user has permission
    if (workspaceId && workspaceId !== 'system') {
      const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
      roleGuard(role, [Permissions.CREATE_TASK]); // Using CREATE_TASK permission for now
    }

    const { template } = await createTemplateService(
      workspaceId && workspaceId !== 'system' ? workspaceId : null,
      userId,
      body
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Template created successfully',
      template,
    });
  }
);

export const getTemplateByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = req.params.workspaceId;
    const templateId = templateIdSchema.parse(req.params.templateId);

    // If workspaceId is provided, verify user has permission
    if (workspaceId && workspaceId !== 'system') {
      const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
      roleGuard(role, [Permissions.VIEW_ONLY]);
    }

    const { template } = await getTemplateByIdService(templateId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Template fetched successfully',
      template,
    });
  }
);

export const getTemplatesByWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = req.params.workspaceId;
    const category = req.query.category as string | undefined;

    // If workspaceId is provided, verify user has permission
    if (workspaceId && workspaceId !== 'system') {
      const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
      roleGuard(role, [Permissions.VIEW_ONLY]);
    }

    const { templates } = await getTemplatesByWorkspaceService(
      workspaceId && workspaceId !== 'system' ? workspaceId : null,
      category,
      userId ? String(userId) : undefined
    );

    return res.status(HTTPSTATUS.OK).json({
      message: 'Templates fetched successfully',
      templates,
    });
  }
);

export const updateTemplateController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = req.params.workspaceId;
    const templateId = templateIdSchema.parse(req.params.templateId);
    const body = updateTemplateSchema.parse(req.body);

    // If workspaceId is provided, verify user has permission
    if (workspaceId && workspaceId !== 'system') {
      const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
      roleGuard(role, [Permissions.EDIT_TASK]); // Using EDIT_TASK permission for now
    }

    const { template } = await updateTemplateService(templateId, userId, body);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Template updated successfully',
      template,
    });
  }
);

export const deleteTemplateController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = req.params.workspaceId;
    const templateId = templateIdSchema.parse(req.params.templateId);

    // If workspaceId is provided, verify user has permission
    if (workspaceId && workspaceId !== 'system') {
      const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
      roleGuard(role, [Permissions.DELETE_TASK]); // Using DELETE_TASK permission for now
    }

    const { message } = await deleteTemplateService(templateId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message,
    });
  }
);

export const seedDefaultTemplatesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const { message, templates } = await seedDefaultTemplatesService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message,
      templates,
    });
  }
);

