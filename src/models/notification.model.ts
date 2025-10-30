import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  _id: string;
  userId: string;
  workspaceId: string;
  pageId?: string;
  type: 'mention' | 'task_assigned' | 'page_shared' | 'workspace_invite';
  title: string;
  message: string;
  data?: {
    mentionedBy?: string;
    mentionedByUser?: {
      _id: string;
      name: string;
      email: string;
      profilePicture?: string;
    };
    pageTitle?: string;
    pageUrl?: string;
    workspaceName?: string;
  };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    workspaceId: {
      type: String,
      required: true,
      ref: 'Workspace',
    },
    pageId: {
      type: String,
      ref: 'Page',
    },
    type: {
      type: String,
      enum: ['mention', 'task_assigned', 'page_shared', 'workspace_invite'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ workspaceId: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
