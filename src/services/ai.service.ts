import { BadRequestException } from '../utils/appError';
import { config } from '../config/app.config';

export type AIAction = 'summarize' | 'improve' | 'rewrite' | 'complete';

export const aiAssistService = async (action: AIAction, text: string): Promise<{ result: string }> => {
  if (!config.GEMINI_API_KEY) {
    throw new BadRequestException('AI provider not configured');
  }

  // Try multiple model names in order of preference
  const modelNames = [
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-1.5-flash-001',
    'gemini-pro-latest'
  ];

    // Lazy require to avoid import issues if package not installed yet
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

  let lastError: any = null;

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = buildPrompt(action, text);
    const response = await model.generateContent(prompt);
    const result = response?.response?.text?.() || '';
    return { result };
  } catch (err: any) {
      lastError = err;
      // If it's a 404 model not found, try the next model
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        continue;
      }
      // For other errors, throw immediately
    throw new BadRequestException(`AI request failed: ${err.message || 'Unknown error'}`);
    }
  }

  // If all models failed with 404, throw a helpful error
  throw new BadRequestException(
    `AI request failed: No supported Gemini model found. Please check your API key has access to Gemini models. Last error: ${lastError?.message || 'Unknown error'}`
  );
};

const buildPrompt = (action: AIAction, text: string): string => {
  switch (action) {
    case 'summarize':
      return `Summarize the following text in 3-5 bullet points. Keep key details and be concise.\n\nText:\n${text}`;
    case 'improve':
      return `Improve clarity, grammar, and tone for the following text. Keep meaning, return the improved version only.\n\nText:\n${text}`;
    case 'complete':
      return `Continue the following text naturally. Write the next 5-10 words that would logically follow. Be concise and contextually relevant. Return ONLY the continuation, not the original text.\n\nText:\n${text}\n\nContinuation:`;
    case 'rewrite':
    default:
      return `Rewrite the following text to be more concise and professional. Return only the rewritten text.\n\nText:\n${text}`;
  }
};




