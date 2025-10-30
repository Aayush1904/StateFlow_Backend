import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import {
  createCommentService,
  getCommentsByPageService,
  updateCommentService,
  deleteCommentService,
  resolveCommentService,
} from '../services/comment.service';

const commentIdSchema = z.string().trim().min(1);
const pageIdSchema = z.string().trim().min(1);
const workspaceIdSchema = z.string().trim().min(1);

const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  parentCommentId: z.string().optional(),
});

export const createCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const pageId = pageIdSchema.parse(req.params.pageId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = createCommentSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { comment } = await createCommentService({
      pageId,
      userId,
      workspaceId,
      content: body.content,
      from: body.from,
      to: body.to,
      parentCommentId: body.parentCommentId,
    });

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Comment created successfully',
      comment,
    });
  }
);

export const getCommentsByPageController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const pageId = pageIdSchema.parse(req.params.pageId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const includeResolved = req.query.includeResolved === 'true';

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { comments } = await getCommentsByPageService(
      pageId,
      workspaceId,
      includeResolved
    );

    return res.status(HTTPSTATUS.OK).json({
      message: 'Comments fetched successfully',
      comments,
    });
  }
);

export const updateCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const commentId = commentIdSchema.parse(req.params.commentId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const content = z.string().min(1).max(1000).parse(req.body.content);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { comment } = await updateCommentService(
      commentId,
      userId,
      workspaceId,
      content
    );

    return res.status(HTTPSTATUS.OK).json({
      message: 'Comment updated successfully',
      comment,
    });
  }
);

export const deleteCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const commentId = commentIdSchema.parse(req.params.commentId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    await deleteCommentService(commentId, userId, workspaceId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Comment deleted successfully',
    });
  }
);

export const resolveCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const commentId = commentIdSchema.parse(req.params.commentId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const resolved = z.boolean().parse(req.body.resolved);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { comment } = await resolveCommentService(
      commentId,
      userId,
      workspaceId,
      resolved
    );

    return res.status(HTTPSTATUS.OK).json({
      message: resolved ? 'Comment resolved successfully' : 'Comment unresolved successfully',
      comment,
    });
  }
);
