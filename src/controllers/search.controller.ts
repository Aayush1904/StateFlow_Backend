import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import { searchService } from '../services/search.service';

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  types: z.array(z.enum(['page', 'task', 'project'])).optional(),
  projectId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const searchController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = req.params.workspaceId;
    const body = searchSchema.parse(req.body);

    // Verify user has access to workspace
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { results, totalCount, hasMore } = await searchService({
      workspaceId,
      query: body.query,
      types: body.types,
      projectId: body.projectId,
      limit: body.limit,
      offset: body.offset,
    });

    return res.status(HTTPSTATUS.OK).json({
      message: 'Search completed successfully',
      results,
      pagination: {
        totalCount,
        hasMore,
        limit: body.limit,
        offset: body.offset,
      },
    });
  }
);

