import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { getMemberRoleInWorkspace } from '../services/member.service';
import { roleGuard } from '../utils/roleGuard';
import { Permissions } from '../enums/role.enum';
import { HTTPSTATUS } from '../config/http.config';
import {
  createIntegrationService,
  getIntegrationsByWorkspaceService,
  getIntegrationByIdService,
  updateIntegrationService,
  deleteIntegrationService,
  testIntegrationService,
} from '../services/integration.service';
import {
  syncGitHubIssuesService,
  syncGitHubAllDataService,
  createGitHubIssueService,
  getGitHubRepositoryService,
  getGitHubPullRequestsService,
  getGitHubCommitsService,
  getGitHubReleasesService,
  getGitHubContributorsService,
  getGitHubBranchesService,
} from '../services/githubIntegration.service';
import {
  syncGoogleCalendarEventsService,
  createGoogleCalendarEventService,
} from '../services/calendarIntegration.service';
import { IntegrationType, IntegrationStatus } from '../models/integration.model';

const workspaceIdSchema = z.string().trim().min(1);
const integrationIdSchema = z.string().trim().min(1);

const createIntegrationSchema = z.object({
  type: z.nativeEnum(IntegrationType),
  name: z.string().trim().min(1).max(255),
  config: z.record(z.any()),
});

const updateIntegrationSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  config: z.record(z.any()).optional(),
  status: z.nativeEnum(IntegrationStatus).optional(),
  metadata: z.record(z.any()).optional(),
});

const syncGitHubIssuesSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
});

const createGitHubIssueSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
});

const syncCalendarEventsSchema = z.object({
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
});

const createCalendarEventSchema = z.object({
  summary: z.string().trim().min(1),
  description: z.string().optional(),
  start: z.object({
    dateTime: z.string(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: z.string().optional(),
  }),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export const createIntegrationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = createIntegrationSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_PROJECT]); // Using CREATE_PROJECT permission for integrations

    const { integration } = await createIntegrationService(workspaceId, userId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Integration created successfully',
      integration,
    });
  }
);

export const getIntegrationsByWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { integrations } = await getIntegrationsByWorkspaceService(workspaceId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Integrations fetched successfully',
      integrations,
    });
  }
);

export const getIntegrationByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { integration } = await getIntegrationByIdService(integrationId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Integration fetched successfully',
      integration,
    });
  }
);

export const updateIntegrationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const body = updateIntegrationSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_PROJECT]);

    const { integration } = await updateIntegrationService(integrationId, userId, body);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Integration updated successfully',
      integration,
    });
  }
);

export const deleteIntegrationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_PROJECT]);

    const { message } = await deleteIntegrationService(integrationId);

    return res.status(HTTPSTATUS.OK).json({
      message,
    });
  }
);

export const testIntegrationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await testIntegrationService(integrationId);

    return res.status(HTTPSTATUS.OK).json(result);
  }
);

// GitHub-specific endpoints
export const getGitHubIssuesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { issues, synced } = await syncGitHubIssuesService(integrationId);
    return res.status(HTTPSTATUS.OK).json({
      message: 'GitHub issues fetched successfully',
      issues,
      count: synced,
    });
  }
);

export const syncGitHubIssuesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const body = syncGitHubIssuesSchema.parse(req.body);
    const syncAll = req.query.syncAll === 'true';

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    if (syncAll) {
      // Comprehensive sync - fetch all data
      const result = await syncGitHubAllDataService(integrationId, body.projectId);
      const totalSynced = result.synced.issues + result.synced.pullRequests + result.synced.commits + 
                          result.synced.releases + result.synced.contributors + result.synced.branches;
      
      return res.status(HTTPSTATUS.OK).json({
        message: `Synced ${totalSynced} GitHub items successfully`,
        ...result,
      });
    } else {
      // Legacy sync - issues only
      const { issues, synced } = await syncGitHubIssuesService(integrationId, body.projectId);
      return res.status(HTTPSTATUS.OK).json({
        message: `Synced ${synced} GitHub issues successfully`,
        issues,
        synced,
      });
    }
  }
);

export const createGitHubIssueController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const body = createGitHubIssueSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_TASK]);

    const { issue } = await createGitHubIssueService(integrationId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'GitHub issue created successfully',
      issue,
    });
  }
);

export const getGitHubRepositoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { repository } = await getGitHubRepositoryService(integrationId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Repository information fetched successfully',
      repository,
    });
  }
);

export const getGitHubPullRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'all';

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { pullRequests, count } = await getGitHubPullRequestsService(integrationId, state);

    return res.status(HTTPSTATUS.OK).json({
      message: `Fetched ${count} pull requests successfully`,
      pullRequests,
      count,
    });
  }
);

export const getGitHubCommitsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const branch = req.query.branch as string | undefined;
    const perPage = parseInt(req.query.perPage as string) || 30;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { commits, count } = await getGitHubCommitsService(integrationId, branch, perPage);

    return res.status(HTTPSTATUS.OK).json({
      message: `Fetched ${count} commits successfully`,
      commits,
      count,
    });
  }
);

export const getGitHubReleasesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const perPage = parseInt(req.query.perPage as string) || 30;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { releases, count } = await getGitHubReleasesService(integrationId, perPage);

    return res.status(HTTPSTATUS.OK).json({
      message: `Fetched ${count} releases successfully`,
      releases,
      count,
    });
  }
);

export const getGitHubContributorsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { contributors, count } = await getGitHubContributorsService(integrationId);

    return res.status(HTTPSTATUS.OK).json({
      message: `Fetched ${count} contributors successfully`,
      contributors,
      count,
    });
  }
);

export const getGitHubBranchesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { branches, count } = await getGitHubBranchesService(integrationId);

    return res.status(HTTPSTATUS.OK).json({
      message: `Fetched ${count} branches successfully`,
      branches,
      count,
    });
  }
);

// Google Calendar-specific endpoints
export const syncCalendarEventsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const body = syncCalendarEventsSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { events, synced } = await syncGoogleCalendarEventsService(
      integrationId,
      body.timeMin,
      body.timeMax
    );

    return res.status(HTTPSTATUS.OK).json({
      message: `Synced ${synced} calendar events successfully`,
      events,
      synced,
    });
  }
);

export const createCalendarEventController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const integrationId = integrationIdSchema.parse(req.params.integrationId);
    const body = createCalendarEventSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_TASK]);

    const { event } = await createGoogleCalendarEventService(integrationId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: 'Calendar event created successfully',
      event,
    });
  }
);


