import { Router } from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.middleware';
import {
  createTemplateController,
  getTemplateByIdController,
  getTemplatesByWorkspaceController,
  updateTemplateController,
  deleteTemplateController,
  seedDefaultTemplatesController,
} from '../controllers/pageTemplate.controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Seed default templates (admin only - can be called without workspace)
router.post('/templates/seed-defaults', seedDefaultTemplatesController);

// Get templates for a workspace (or system templates)
router.get('/workspace/:workspaceId/templates', getTemplatesByWorkspaceController);

// Get a specific template
router.get('/workspace/:workspaceId/templates/:templateId', getTemplateByIdController);

// Create a new template
router.post('/workspace/:workspaceId/templates', createTemplateController);

// Update a template
router.put('/workspace/:workspaceId/templates/:templateId', updateTemplateController);

// Delete a template
router.delete('/workspace/:workspaceId/templates/:templateId', deleteTemplateController);

export default router;

