import { Router } from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.middleware';
import {
  createIntegrationController,
  getIntegrationsByWorkspaceController,
  getIntegrationByIdController,
  updateIntegrationController,
  deleteIntegrationController,
  testIntegrationController,
  getGitHubIssuesController,
  syncGitHubIssuesController,
  createGitHubIssueController,
  getGitHubRepositoryController,
  getGitHubPullRequestsController,
  getGitHubCommitsController,
  getGitHubReleasesController,
  getGitHubContributorsController,
  getGitHubBranchesController,
  syncCalendarEventsController,
  createCalendarEventController,
} from '../controllers/integration.controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Basic CRUD operations
router.post('/workspace/:workspaceId/integrations', createIntegrationController);
router.get('/workspace/:workspaceId/integrations', getIntegrationsByWorkspaceController);
router.get('/workspace/:workspaceId/integrations/:integrationId', getIntegrationByIdController);
router.put('/workspace/:workspaceId/integrations/:integrationId', updateIntegrationController);
router.delete('/workspace/:workspaceId/integrations/:integrationId', deleteIntegrationController);
router.post('/workspace/:workspaceId/integrations/:integrationId/test', testIntegrationController);

// GitHub-specific endpoints
router.get('/workspace/:workspaceId/integrations/:integrationId/github/issues', getGitHubIssuesController);
router.post('/workspace/:workspaceId/integrations/:integrationId/github/sync', syncGitHubIssuesController);
router.post('/workspace/:workspaceId/integrations/:integrationId/github/issues', createGitHubIssueController);
router.get('/workspace/:workspaceId/integrations/:integrationId/github/repository', getGitHubRepositoryController);
router.get('/workspace/:workspaceId/integrations/:integrationId/github/pull-requests', getGitHubPullRequestsController);
router.get('/workspace/:workspaceId/integrations/:integrationId/github/commits', getGitHubCommitsController);
router.get('/workspace/:workspaceId/integrations/:integrationId/github/releases', getGitHubReleasesController);
router.get('/workspace/:workspaceId/integrations/:integrationId/github/contributors', getGitHubContributorsController);
router.get('/workspace/:workspaceId/integrations/:integrationId/github/branches', getGitHubBranchesController);

// Google Calendar-specific endpoints
router.post('/workspace/:workspaceId/integrations/:integrationId/calendar/sync', syncCalendarEventsController);
router.post('/workspace/:workspaceId/integrations/:integrationId/calendar/events', createCalendarEventController);

export default router;

