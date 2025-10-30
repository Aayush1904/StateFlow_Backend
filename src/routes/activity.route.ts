import { Router } from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.middleware';
import {
  getActivitiesController,
  getActivityByIdController,
  deleteActivityController,
} from '../controllers/activity.controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// GET /api/workspaces/:workspaceId/activities - Get activities for workspace
router.get('/:workspaceId/activities', getActivitiesController);

// GET /api/workspaces/:workspaceId/activities/:activityId - Get specific activity
router.get('/:workspaceId/activities/:activityId', getActivityByIdController);

// DELETE /api/workspaces/:workspaceId/activities/:activityId - Delete activity
router.delete('/:workspaceId/activities/:activityId', deleteActivityController);

export default router;
