import { Router } from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.middleware';
import {
  createPageController,
  getPageByIdController,
  getPagesByWorkspaceController,
  updatePageController,
  deletePageController,
} from '../controllers/page.controller';
import {
  createPageVersionController,
  getPageVersionsController,
  getPageVersionByIdController,
  restorePageVersionController,
  comparePageVersionsController,
} from '../controllers/pageVersion.controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Create a new page
router.post('/workspace/:workspaceId/pages', createPageController);

// Get all pages in a workspace
router.get('/workspace/:workspaceId/pages', getPagesByWorkspaceController);

// Get a specific page
router.get('/workspace/:workspaceId/pages/:pageId', getPageByIdController);

// Update a page
router.put('/workspace/:workspaceId/pages/:pageId', updatePageController);

// Delete a page
router.delete('/workspace/:workspaceId/pages/:pageId', deletePageController);

// Page Version Routes
// Create a new page version
router.post('/workspace/:workspaceId/pages/:pageId/versions', createPageVersionController);

// Get all versions of a page
router.get('/workspace/:workspaceId/pages/:pageId/versions', getPageVersionsController);

// Get a specific page version
router.get('/workspace/:workspaceId/pages/:pageId/versions/:versionId', getPageVersionByIdController);

// Restore a page version
router.post('/workspace/:workspaceId/pages/:pageId/versions/:versionId/restore', restorePageVersionController);

// Compare two page versions
router.get('/workspace/:workspaceId/pages/:pageId/versions/:versionId1/compare/:versionId2', comparePageVersionsController);

export default router;
