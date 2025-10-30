import { Router } from 'express';
import {
  createCommentController,
  getCommentsByPageController,
  updateCommentController,
  deleteCommentController,
  resolveCommentController,
} from '../controllers/comment.controller';

const router = Router();

// Get all comments for a page
router.get('/workspace/:workspaceId/pages/:pageId/comments', getCommentsByPageController);

// Create a new comment
router.post('/workspace/:workspaceId/pages/:pageId/comments', createCommentController);

// Update a comment
router.put('/workspace/:workspaceId/comments/:commentId', updateCommentController);

// Delete a comment
router.delete('/workspace/:workspaceId/comments/:commentId', deleteCommentController);

// Resolve/unresolve a comment
router.patch('/workspace/:workspaceId/comments/:commentId/resolve', resolveCommentController);

export default router;

