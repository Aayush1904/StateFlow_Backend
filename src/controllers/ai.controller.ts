import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middlewares/asyncHandler.middleware';
import { aiAssistService } from '../services/ai.service';
import { HTTPSTATUS } from '../config/http.config';

const aiSchema = z.object({
  action: z.enum(['summarize', 'improve', 'rewrite', 'complete']),
  text: z.string().min(1),
});

export const aiAssistController = asyncHandler(async (req: Request, res: Response) => {
  const { action, text } = aiSchema.parse(req.body);
  const { result } = await aiAssistService(action, text);
  return res.status(HTTPSTATUS.OK).json({ message: 'OK', result });
});




