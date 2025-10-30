import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  getUserNotificationsService,
  markNotificationAsReadService,
  markAllNotificationsAsReadService,
  deleteNotificationService,
} from '../services/notification.service';

const notificationIdSchema = z.string().trim().min(1);

const getNotificationsSchema = z.object({
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 50),
  offset: z.string().optional().transform((val) => val ? parseInt(val) : 0),
});

export const getUserNotificationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const query = getNotificationsSchema.parse(req.query);

    const { notifications, totalCount, unreadCount } = await getUserNotificationsService(
      userId,
      query.limit,
      query.offset
    );

    return res.status(HTTPSTATUS.OK).json({
      message: 'Notifications fetched successfully',
      notifications,
      totalCount,
      unreadCount,
    });
  }
);

export const markNotificationAsReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const notificationId = notificationIdSchema.parse(req.params.notificationId);

    const { notification } = await markNotificationAsReadService(notificationId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Notification marked as read',
      notification,
    });
  }
);

export const markAllNotificationsAsReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const { updatedCount } = await markAllNotificationsAsReadService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'All notifications marked as read',
      updatedCount,
    });
  }
);

export const deleteNotificationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const notificationId = notificationIdSchema.parse(req.params.notificationId);

    const { notification } = await deleteNotificationService(notificationId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: 'Notification deleted successfully',
      notification,
    });
  }
);
