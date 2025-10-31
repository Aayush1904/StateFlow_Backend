import { BadRequestException } from '../utils/appError';
import { config } from '../config/app.config';

export type AIAction = 'summarize' | 'improve' | 'rewrite' | 'complete';

export const aiAssistService = async (action: AIAction, text: string): Promise<{ result: string }> => {
  if (!config.GEMINI_API_KEY) {
    throw new BadRequestException('AI provider not configured');
  }

  // Optimize text length based on action for faster processing
  let optimizedText = text;
  if (action === 'complete') {
    // For autocomplete, use only last 150 chars for faster response
    optimizedText = text.slice(-150);
  } else if (action === 'summarize') {
    // For summarize, limit to 2000 chars max
    optimizedText = text.slice(0, 2000);
  } else {
    // For improve/rewrite, limit to 1500 chars
    optimizedText = text.slice(0, 1500);
  }

  // Use fastest models first for quick responses
  // gemini-1.5-flash is optimized for speed (under 1-2 secs)
  const modelNames = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro', // Fallback for complex tasks
    'gemini-pro',
  ];

  // Lazy require to avoid import issues if package not installed yet
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

  let lastError: any = null;

  for (const modelName of modelNames) {
    try {
      // Configure generation for speed: limit tokens and temperature
      const generationConfig = {
        maxOutputTokens: action === 'complete' ? 30 : action === 'summarize' ? 150 : 500,
        temperature: action === 'complete' ? 0.7 : 0.5,
        topP: 0.8,
        topK: 40,
      };

      // Create model with generationConfig for speed optimization
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig,
      });
      
      const prompt = buildPrompt(action, optimizedText);

      // Add timeout wrapper (5 seconds for fast failure)
      // Pass prompt as string (simpler and more reliable)
      const generatePromise = model.generateContent(prompt);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]) as any;
      const result = response?.response?.text?.() || '';
      
      if (result.trim()) {
        return { result: result.trim() };
      }
    } catch (err: any) {
      lastError = err;
      // If it's a 404 model not found or timeout, try the next model
      if (err.message?.includes('404') || err.message?.includes('not found') || err.message?.includes('timeout') || err.status === 404) {
        continue;
      }
      // Log the actual error for debugging
      console.error(`AI request failed for model ${modelName}:`, err.message || err);
      // For other errors, throw immediately
      throw new BadRequestException(`AI request failed: ${err.message || 'Unknown error'}`);
    }
  }

  // If all models failed, throw a helpful error
  throw new BadRequestException(
    `AI request failed: No supported Gemini model found or request timed out. Last error: ${lastError?.message || 'Unknown error'}`
  );
};

const buildPrompt = (action: AIAction, text: string): string => {
  // Optimized prompts for speed and clarity
  switch (action) {
    case 'summarize':
      return `Summarize in 3-5 bullets:\n\n${text}`;
    case 'improve':
      return `Improve grammar and clarity. Return improved text only:\n\n${text}`;
    case 'complete':
      return `Continue naturally (5-10 words only):\n\n${text}`;
    case 'rewrite':
    default:
      return `Rewrite concisely:\n\n${text}`;
  }
};




