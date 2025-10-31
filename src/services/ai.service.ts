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

  // Use the model that's actually available in your account
  // Based on your Google AI Studio dashboard, you're using gemini-2.5-pro
  const modelNames = [
    'gemini-2.5-pro',        // Primary model from your dashboard
    'gemini-1.5-flash',      // Fast fallback option
    'gemini-1.5-pro',        // More capable fallback
    'gemini-pro',            // Legacy fallback
  ];

  // Lazy require to avoid import issues if package not installed yet
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

  let lastError: any = null;

  for (const modelName of modelNames) {
    try {
      const prompt = buildPrompt(action, optimizedText);

      // Configure generation for speed: limit tokens and temperature
      const generationConfig = {
        maxOutputTokens: action === 'complete' ? 30 : action === 'summarize' ? 150 : 500,
        temperature: action === 'complete' ? 0.7 : 0.5,
        topP: 0.8,
        topK: 40,
      };

      // Create model with generationConfig included
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig,
      });

      // Add timeout wrapper (5 seconds for fast failure)
      // Use simple string prompt format (most reliable)
      const generatePromise = model.generateContent(prompt);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]) as any;
      
      // Handle response - check if it has the expected structure
      if (!response || !response.response) {
        throw new Error('Invalid response structure');
      }
      
      const result = response.response.text();
      
      if (result && result.trim()) {
        return { result: result.trim() };
      }
      
      // If no result, try next model
      continue;
    } catch (err: any) {
      lastError = err;
      
      // Extract error details
      const errorMessage = err.message || '';
      const errorStatus = err.status || err.response?.status || 0;
      const is404 = errorStatus === 404 || errorMessage.includes('404') || errorMessage.includes('not found');
      const is400 = errorStatus === 400 || errorMessage.includes('400');
      const isTimeout = errorMessage.includes('timeout');
      
      // If it's a 404 (model not found) or timeout, try the next model
      if (is404 || isTimeout) {
        console.warn(`Model ${modelName} not available (${is404 ? '404' : 'timeout'}), trying next model...`);
        continue;
      }
      
      // If it's a 400 (bad request), it might be a config issue - try next model
      if (is400) {
        console.warn(`Bad request for model ${modelName}, trying next model...`, errorMessage);
        continue;
      }
      
      // For other unexpected errors, log and try next model if available
      console.error(`Unexpected error for model ${modelName}:`, errorMessage);
      
      // If this is the last model, throw the error
      if (modelNames.indexOf(modelName) === modelNames.length - 1) {
        throw new BadRequestException(`AI request failed: ${errorMessage || 'Unknown error'}`);
      }
      
      // Otherwise, continue to next model
      continue;
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




