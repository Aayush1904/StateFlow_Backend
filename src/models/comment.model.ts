import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  _id: string;
  pageId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  content: string;
  from: number; // Character position start
  to: number; // Character position end
  parentCommentId?: mongoose.Types.ObjectId | null; // For threaded replies
  resolved: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    pageId: {
      type: Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    from: {
      type: Number,
      required: true,
    },
    to: {
      type: Number,
      required: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
// Compound index for querying comments by page and resolved status
commentSchema.index({ pageId: 1, resolved: 1 });
// workspaceId already has index: true in schema definition
// Index for parent comment (threaded replies)
commentSchema.index({ parentCommentId: 1 });

const Comment = mongoose.model<IComment>('Comment', commentSchema);

export default Comment;

