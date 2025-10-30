import Comment from '../models/comment.model';
import PageModel from '../models/page.model';
import User from '../models/user.model';
import mongoose from 'mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '../utils/appError';
import { createActivityService } from './activity.service';

export interface CreateCommentData {
  pageId: string;
  userId: string;
  workspaceId: string;
  content: string;
  from: number;
  to: number;
  parentCommentId?: string;
}

export const createCommentService = async (data: CreateCommentData) => {
  const { pageId, userId, workspaceId, content, from, to, parentCommentId } = data;

  // Verify page exists and belongs to workspace
  const page = await PageModel.findById(pageId);
  if (!page || page.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException('Page not found or does not belong to this workspace');
  }

  // If it's a reply, verify parent comment exists
  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment || parentComment.pageId.toString() !== pageId) {
      throw new NotFoundException('Parent comment not found');
    }
  }

  // Validate positions
  if (from < 0 || to < from) {
    throw new BadRequestException('Invalid comment position');
  }

  const comment = new Comment({
    pageId,
    userId,
    workspaceId,
    content,
    from,
    to,
    parentCommentId: parentCommentId || null,
    resolved: false,
  });

  await comment.save();
  await comment.populate('userId', 'name email profilePicture');

  // Create activity
  try {
    const user = await User.findById(userId);
    if (user) {
      await createActivityService({
        workspaceId,
        userId,
        type: 'comment_added',
        title: 'Comment added',
        description: `${user.name} added a comment on "${page.title}"`,
        resourceType: 'comment',
        resourceId: comment._id.toString(),
        resourceName: page.title,
        data: {
          commentText: content,
          pageId: pageId,
          parentCommentId: parentCommentId || null,
        },
      });
    }
  } catch (error) {
    console.error('Failed to create comment activity:', error);
    // Don't throw - comment creation should succeed even if activity fails
  }

  return { comment };
};

export const getCommentsByPageService = async (
  pageId: string,
  workspaceId: string,
  includeResolved: boolean = false
) => {
  // Verify page exists and belongs to workspace
  const page = await PageModel.findById(pageId);
  if (!page || page.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException('Page not found or does not belong to this workspace');
  }

  const filter: any = {
    pageId,
    workspaceId,
  };

  if (!includeResolved) {
    filter.resolved = false;
  }

  const comments = await Comment.find(filter)
    .populate('userId', 'name email profilePicture')
    .populate('resolvedBy', 'name email profilePicture')
    .populate('parentCommentId')
    .sort({ createdAt: 1 });

  return { comments };
};

export const updateCommentService = async (
  commentId: string,
  userId: string,
  workspaceId: string,
  content: string
) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new NotFoundException('Comment not found');
  }

  if (comment.workspaceId.toString() !== workspaceId.toString()) {
    throw new ForbiddenException('Comment does not belong to this workspace');
  }

  if (comment.userId.toString() !== userId.toString()) {
    throw new ForbiddenException('You can only edit your own comments');
  }

  comment.content = content;
  await comment.save();
  await comment.populate('userId', 'name email profilePicture');

  return { comment };
};

export const deleteCommentService = async (
  commentId: string,
  userId: string,
  workspaceId: string
) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new NotFoundException('Comment not found');
  }

  if (comment.workspaceId.toString() !== workspaceId.toString()) {
    throw new ForbiddenException('Comment does not belong to this workspace');
  }

  // Only comment author or workspace admin can delete
  if (comment.userId.toString() !== userId.toString()) {
    // Check if user is workspace admin/owner (you might want to add this check)
    // For now, only allow author to delete
    throw new ForbiddenException('You can only delete your own comments');
  }

  // Delete all replies if any
  await Comment.deleteMany({ parentCommentId: commentId });

  await Comment.findByIdAndDelete(commentId);

  return { message: 'Comment deleted successfully' };
};

export const resolveCommentService = async (
  commentId: string,
  userId: string,
  workspaceId: string,
  resolved: boolean
) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new NotFoundException('Comment not found');
  }

  if (comment.workspaceId.toString() !== workspaceId.toString()) {
    throw new ForbiddenException('Comment does not belong to this workspace');
  }

  comment.resolved = resolved;
  comment.resolvedAt = resolved ? new Date() : null;
  comment.resolvedBy = resolved ? new mongoose.Types.ObjectId(userId) : null;

  await comment.save();
  await comment.populate('userId', 'name email profilePicture');
  await comment.populate('resolvedBy', 'name email profilePicture');

  return { comment };
};
