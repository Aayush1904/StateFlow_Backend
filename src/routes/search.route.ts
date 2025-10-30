import { Router } from 'express';
import { searchController } from '../controllers/search.controller';

const router = Router();

// Search across pages, tasks, and projects
router.post('/workspace/:workspaceId/search', searchController);

export default router;

