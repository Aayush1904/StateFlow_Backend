import { Notification, INotification } from '../models/notification.model';
import User from '../models/user.model';
import Page from '../models/page.model';
import Workspace from '../models/workspace.model';

export interface CreateMentionNotificationData {
  mentionedUserId: string;
  mentionedByUserId: string;
  workspaceId: string;
  pageId: string;
  pageTitle: string;
  workspaceName: string;
}

export interface CreateNotificationData {
  userId: string;
  workspaceId: string;
  pageId?: string;
  type: 'mention' | 'task_assigned' | 'page_shared' | 'workspace_invite';
  title: string;
  message: string;
  data?: any;
}

export const createMentionNotificationService = async (data: CreateMentionNotificationData) => {
  try {
    // Get mentioned user details
    const mentionedUser = await User.findById(data.mentionedUserId);
    if (!mentionedUser) {
      throw new Error('Mentioned user not found');
    }

    // Get mentioned by user details
    const mentionedByUser = await User.findById(data.mentionedByUserId);
    if (!mentionedByUser) {
      throw new Error('Mentioning user not found');
    }

    // Check if user is already mentioned in this page recently (within 5 minutes)
    const recentMention = await Notification.findOne({
      userId: data.mentionedUserId,
      pageId: data.pageId,
      type: 'mention',
      'data.mentionedBy': data.mentionedByUserId,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes ago
    });

    if (recentMention) {
      console.log('Recent mention found, skipping duplicate notification');
      return { notification: recentMention };
    }

    // Create notification
    const notification = new Notification({
      userId: data.mentionedUserId,
      workspaceId: data.workspaceId,
      pageId: data.pageId,
      type: 'mention',
      title: `You were mentioned by ${mentionedByUser.name}`,
      message: `${mentionedByUser.name} mentioned you in "${data.pageTitle}"`,
      data: {
        mentionedBy: data.mentionedByUserId,
        mentionedByUser: {
          _id: mentionedByUser._id,
          name: mentionedByUser.name,
          email: mentionedByUser.email,
          profilePicture: mentionedByUser.profilePicture,
        },
        pageTitle: data.pageTitle,
        pageUrl: `/workspace/${data.workspaceId}/pages/${data.pageId}`,
        workspaceName: data.workspaceName,
      },
    });

    await notification.save();

    return { notification };
  } catch (error) {
    console.error('Error creating mention notification:', error);
    throw error;
  }
};

export const createNotificationService = async (data: CreateNotificationData) => {
  try {
    const notification = new Notification({
      userId: data.userId,
      workspaceId: data.workspaceId,
      pageId: data.pageId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data || {},
    });

    await notification.save();
    return { notification };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const getUserNotificationsService = async (userId: string, limit = 50, offset = 0) => {
  try {
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .populate('workspaceId', 'name')
      .populate('pageId', 'title');

    const totalCount = await Notification.countDocuments({ userId });
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return {
      notifications,
      totalCount,
      unreadCount,
    };
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    throw error;
  }
};

export const markNotificationAsReadService = async (notificationId: string, userId: string) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return { notification };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsReadService = async (userId: string) => {
  try {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return { updatedCount: result.modifiedCount };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotificationService = async (notificationId: string, userId: string) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return { notification };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};
