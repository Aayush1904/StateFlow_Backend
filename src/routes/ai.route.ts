import { Router } from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.middleware';
import { aiAssistController } from '../controllers/ai.controller';

const router = Router();

router.use(isAuthenticated);
router.post('/assist', aiAssistController);

export default router;






