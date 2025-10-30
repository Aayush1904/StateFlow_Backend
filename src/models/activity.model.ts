import mongoose, { Document, Schema } from 'mongoose';

export interface IActivity extends Document {
  _id: string;
  workspaceId: string;
  userId: string;
  type: 'page_created' | 'page_updated' | 'page_deleted' | 'task_created' | 'task_updated' | 'task_deleted' | 'task_moved' | 'project_created' | 'project_updated' | 'project_deleted' | 'member_added' | 'member_removed' | 'member_role_changed' | 'comment_added' | 'mention_added';
  title: string;
  description: string;
  resourceType: 'page' | 'task' | 'project' | 'member' | 'comment';
  resourceId?: string;
  resourceName?: string;
  projectId?: string;
  projectName?: string;
  data?: {
    oldStatus?: string;
    newStatus?: string;
    oldPriority?: string;
    newPriority?: string;
    oldAssignee?: string;
    newAssignee?: string;
    oldColumn?: string;
    newColumn?: string;
    mentionedUsers?: string[];
    commentText?: string;
    changes?: any;
  };
  user: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>({
  workspaceId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'page_created', 'page_updated', 'page_deleted',
      'task_created', 'task_updated', 'task_deleted', 'task_moved',
      'project_created', 'project_updated', 'project_deleted',
      'member_added', 'member_removed', 'member_role_changed',
      'comment_added', 'mention_added'
    ],
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['page', 'task', 'project', 'member', 'comment'],
    index: true,
  },
  resourceId: {
    type: String,
    index: true,
  },
  resourceName: {
    type: String,
  },
  projectId: {
    type: String,
    index: true,
  },
  projectName: {
    type: String,
  },
  data: {
    type: Schema.Types.Mixed,
    default: {},
  },
  user: {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    profilePicture: { type: String },
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
activitySchema.index({ workspaceId: 1, createdAt: -1 });
activitySchema.index({ workspaceId: 1, userId: 1, createdAt: -1 });
activitySchema.index({ workspaceId: 1, resourceType: 1, createdAt: -1 });
activitySchema.index({ workspaceId: 1, projectId: 1, createdAt: -1 });

export const ActivityModel = mongoose.model<IActivity>('Activity', activitySchema);
