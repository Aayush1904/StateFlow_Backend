import { Router } from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.middleware';
import {
  getUserNotificationsController,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
  deleteNotificationController,
} from '../controllers/notification.controller';

const router = Router();

// All notification routes require authentication
router.use(isAuthenticated);

// Get user notifications
router.get('/', getUserNotificationsController);

// Mark notification as read
router.patch('/:notificationId/read', markNotificationAsReadController);

// Mark all notifications as read
router.patch('/read-all', markAllNotificationsAsReadController);

// Delete notification
router.delete('/:notificationId', deleteNotificationController);

export default router;
