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

  // Based on your dashboard, use models with better rate limits
  // gemini-2.5-pro has only 2 RPM which is too low - causing rate limit errors
  // Prioritize Flash models which are fast AND have higher rate limits
  const modelNames = [
    'gemini-2.0-flash-lite',  // Best: 30 RPM, 1M TPM, 200 RPD (fastest & highest limits)
    'gemini-2.0-flash',       // Good: 15 RPM, 1M TPM, 200 RPD (fast & high limits)
    'gemini-2.5-flash-lite',  // Good: 15 RPM, 250K TPM, 1K RPD
    'gemini-2.5-flash',       // Good: 10 RPM, 250K TPM, 250 RPD
    'gemini-1.5-flash',       // Fallback: Widely available
    'gemini-1.5-pro',         // Fallback: More capable
    // Avoid gemini-2.5-pro (only 2 RPM - too low!)
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

      // Create model with generationConfig (this is the correct way for this SDK)
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig,
      });

      // Add timeout wrapper (5 seconds for fast failure)
      // Pass prompt as simple string (SDK handles the conversion)
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
      
      if (result && typeof result === 'string' && result.trim()) {
        return { result: result.trim() };
      }
      
      // If result is a function (some SDK versions), call it
      if (typeof result === 'function') {
        const textResult = result();
        if (textResult && textResult.trim()) {
          return { result: textResult.trim() };
        }
      }
      
      // If no result, try next model
      continue;
    } catch (err: any) {
      lastError = err;
      
      // Extract detailed error information
      const errorMessage = err.message || err.toString() || 'Unknown error';
      const errorStatus = err.status || err.response?.status || err.statusCode || 0;
      const errorDetails = err.response?.data || err.error || {};
      
      // Log detailed error for debugging
      console.error(`AI Error for model ${modelName}:`, {
        status: errorStatus,
        message: errorMessage,
        details: errorDetails,
        fullError: err,
      });
      
      const is404 = errorStatus === 404 || errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND');
      const is400 = errorStatus === 400 || errorMessage.includes('400') || errorMessage.includes('Bad Request');
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT');
      
      // If it's a 404 (model not found) or timeout, try the next model
      if (is404 || isTimeout) {
        console.warn(`Model ${modelName} not available (${is404 ? '404' : 'timeout'}), trying next model...`);
        continue;
      }
      
      // If it's a 400 (bad request), log the full error and try next model
      if (is400) {
        console.warn(`Bad request for model ${modelName}. Error:`, errorMessage);
        console.warn(`Error details:`, JSON.stringify(errorDetails, null, 2));
        // Try next model unless it's a validation error that would affect all models
        if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
          // Don't try other models if it's an auth issue
          throw new BadRequestException(`AI request failed: ${errorMessage}`);
        }
        continue;
      }
      
      // For other unexpected errors, log and try next model if available
      console.error(`Unexpected error for model ${modelName}:`, errorMessage);
      
      // If this is the last model, throw the error
      if (modelNames.indexOf(modelName) === modelNames.length - 1) {
        throw new BadRequestException(`AI request failed: ${errorMessage}. Details: ${JSON.stringify(errorDetails)}`);
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




