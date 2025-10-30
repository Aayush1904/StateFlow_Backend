import mongoose from 'mongoose';
import PageModel from '../models/page.model';
import TaskModel from '../models/task.model';
import ProjectModel from '../models/project.model';
import { NotFoundException } from '../utils/appError';

export interface SearchResult {
  type: 'page' | 'task' | 'project';
  id: string;
  title: string;
  description?: string;
  content?: string;
  project?: {
    id: string;
    name: string;
    emoji?: string;
  };
  metadata?: {
    status?: string;
    priority?: string;
    assignedTo?: {
      id: string;
      name: string;
      profilePicture?: string;
    };
    createdAt?: Date;
    updatedAt?: Date;
  };
  score?: number; // For relevance scoring
}

export interface SearchFilters {
  workspaceId: string;
  query: string;
  types?: ('page' | 'task' | 'project')[];
  projectId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Escapes special regex characters for safe regex search
 */
const escapeRegex = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Creates search patterns for multi-word queries
 * - Exact phrase match
 * - All words match (order matters)
 * - All words match (order doesn't matter)
 * - Individual word matches
 */
const createSearchPatterns = (query: string): RegExp[] => {
  const trimmed = query.trim().toLowerCase();
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  
  const patterns: RegExp[] = [];
  
  if (words.length === 0) {
    return patterns;
  }
  
  // 1. Exact phrase match (highest priority)
  const exactPhrase = escapeRegex(trimmed);
  patterns.push(new RegExp(exactPhrase, 'i'));
  
  // 2. All words in order (with flexible spacing)
  if (words.length > 1) {
    const wordsInOrder = words.map(w => escapeRegex(w)).join('.*');
    patterns.push(new RegExp(wordsInOrder, 'i'));
  }
  
  // 3. All words must be present (order doesn't matter) - using positive lookahead
  // This is complex with regex, so we'll use a simpler approach
  // For each word, create a pattern that matches it
  words.forEach(word => {
    const escapedWord = escapeRegex(word);
    patterns.push(new RegExp(escapedWord, 'i'));
  });
  
  return patterns;
};

/**
 * Checks if text matches any of the search patterns
 */
const matchesPatterns = (text: string, patterns: RegExp[]): boolean => {
  const lowerText = text.toLowerCase();
  return patterns.some(pattern => pattern.test(lowerText));
};

/**
 * Checks if all words from query are present in text (order doesn't matter)
 */
const containsAllWords = (text: string, query: string): boolean => {
  const lowerText = text.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  return words.every(word => lowerText.includes(word));
};

/**
 * Removes HTML tags and extracts text content for searching
 */
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Calculates relevance score based on match position and type
 */
const calculateScore = (item: any, query: string, searchType: 'page' | 'task' | 'project'): number => {
  let score = 0;
  const lowerQuery = query.toLowerCase().trim();
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);
  const lowerTitle = (item.title || item.name || '').toLowerCase();
  
  // Exact title match gives highest score
  if (lowerTitle === lowerQuery) {
    score += 150;
  }
  // Title starts with query
  else if (lowerTitle.startsWith(lowerQuery)) {
    score += 120;
  }
  // Title contains exact phrase
  else if (lowerTitle.includes(lowerQuery)) {
    score += 100;
  }
  // All words in title (order matters)
  else if (queryWords.every(word => lowerTitle.includes(word))) {
    score += 80;
    // Check if words are in order
    const titleWords = lowerTitle.split(/\s+/);
    let wordsInOrder = 0;
    let lastIndex = -1;
    for (const word of queryWords) {
      const index = titleWords.findIndex((w: string, i: number) => w.includes(word) && i > lastIndex);
      if (index >= 0) {
        wordsInOrder++;
        lastIndex = index;
      }
    }
    if (wordsInOrder === queryWords.length) {
      score += 20; // Bonus for words in order
    }
  }
  // Some words in title
  else {
    const matchedWords = queryWords.filter(word => lowerTitle.includes(word)).length;
    score += (matchedWords / queryWords.length) * 50;
  }
  
  // Content match gives medium score
  if (item.content) {
    const content = stripHtml(item.content).toLowerCase();
    if (content.includes(lowerQuery)) {
      score += 20;
    } else if (containsAllWords(content, query)) {
      score += 15;
    }
  }
  
  // Description match gives medium score
  if (item.description) {
    const desc = (item.description || '').toLowerCase();
    if (desc.includes(lowerQuery)) {
      score += 15;
    } else if (containsAllWords(desc, query)) {
      score += 10;
    }
  }
  
  // Recency bonus (newer items slightly higher)
  if (item.createdAt) {
    const daysSinceCreation = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceCreation / 30); // Decay over 30 days
  }
  
  return score;
};

export const searchService = async (filters: SearchFilters) => {
  const {
    workspaceId,
    query,
    types = ['page', 'task', 'project'],
    projectId,
    limit = 50,
    offset = 0,
  } = filters;

  if (!query || query.trim().length === 0) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
    };
  }

  const results: SearchResult[] = [];
  const searchPatterns = createSearchPatterns(query);
  const lowerQuery = query.toLowerCase().trim();
  const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 0);

  // Build base query for workspace - convert to ObjectId if needed
  const workspaceObjectId = typeof workspaceId === 'string' 
    ? new mongoose.Types.ObjectId(workspaceId) 
    : workspaceId;
  const workspaceQuery = { workspace: workspaceObjectId };
  const projectQueryFilter = projectId ? { project: new mongoose.Types.ObjectId(projectId) } : {};

  // Create MongoDB query that matches any pattern
  // We'll use $or with multiple regex patterns for better performance
  const createMongoQuery = (fields: string[]) => {
    const orConditions: any[] = [];
    
    // Exact phrase match
    const exactPhrase = escapeRegex(lowerQuery);
    fields.forEach(field => {
      orConditions.push({ [field]: new RegExp(exactPhrase, 'i') });
    });
    
    // All words match (order matters)
    if (queryWords.length > 1) {
      const allWordsPattern = queryWords.map(w => escapeRegex(w)).join('.*');
      fields.forEach(field => {
        orConditions.push({ [field]: new RegExp(allWordsPattern, 'i') });
      });
    }
    
    // Individual word matches (at least one word)
    queryWords.forEach(word => {
      const wordPattern = escapeRegex(word);
      fields.forEach(field => {
        orConditions.push({ [field]: new RegExp(wordPattern, 'i') });
      });
    });
    
    return { $or: orConditions };
  };

  // Search Pages
  if (types.includes('page')) {
    const pageQuery: any = {
      ...workspaceQuery,
      ...createMongoQuery(['title', 'content']),
    };

    if (projectId) {
      pageQuery.project = projectId;
    }

    const pages = await PageModel.find(pageQuery)
      .populate('project', 'name emoji')
      .populate('createdBy', 'name')
      .limit(limit * 2) // Get more to filter after
      .sort({ updatedAt: -1 })
      .lean();

    for (const page of pages) {
      const content = stripHtml(page.content || '');
      const titleLower = page.title.toLowerCase();
      const contentLower = content.toLowerCase();
      
      // Check if matches - prioritize exact matches and all-words matches
      const exactMatch = titleLower.includes(lowerQuery) || contentLower.includes(lowerQuery);
      const allWordsMatch = containsAllWords(page.title, query) || containsAllWords(content, query);
      
      if (exactMatch || allWordsMatch || matchesPatterns(page.title, searchPatterns) || matchesPatterns(content, searchPatterns)) {
        const score = calculateScore({ ...page, title: page.title, content }, query, 'page');
        results.push({
          type: 'page',
          id: page._id.toString(),
          title: page.title,
          content: content.substring(0, 200), // Preview
          project: page.project && typeof page.project === 'object' && 'name' in page.project
            ? {
                id: (page.project as any)._id?.toString() || '',
                name: (page.project as any).name || '',
                emoji: (page.project as any).emoji,
              }
            : undefined,
          metadata: {
            createdAt: page.createdAt,
            updatedAt: page.updatedAt,
          },
          score: exactMatch ? score + 50 : (allWordsMatch ? score + 25 : score), // Boost exact matches
        });
      }
    }
  }

  // Search Tasks
  if (types.includes('task')) {
    const taskQuery: any = {
      workspace: workspaceObjectId, // Tasks use ObjectId
      ...projectQueryFilter,
      ...createMongoQuery(['title', 'description']),
    };

    const tasks = await TaskModel.find(taskQuery)
      .populate('assignedTo', 'name profilePicture')
      .populate('project', 'name emoji')
      .limit(limit * 2) // Get more to filter after
      .sort({ createdAt: -1 })
      .lean();

    for (const task of tasks) {
      const titleLower = (task.title || '').toLowerCase();
      const descLower = ((task.description || '').toLowerCase());
      
      const exactMatch = titleLower.includes(lowerQuery) || descLower.includes(lowerQuery);
      const allWordsMatch = containsAllWords(task.title || '', query) || 
                           (task.description && containsAllWords(task.description, query));
      
      if (exactMatch || allWordsMatch || matchesPatterns(task.title || '', searchPatterns) || 
          (task.description && matchesPatterns(task.description, searchPatterns))) {
        const score = calculateScore(task, query, 'task');
        results.push({
          type: 'task',
          id: task._id.toString(),
          title: task.title,
          description: task.description || undefined,
          project: task.project && typeof task.project === 'object' && 'name' in task.project
            ? {
                id: (task.project as any)._id?.toString() || '',
                name: (task.project as any).name || '',
                emoji: (task.project as any).emoji,
              }
            : undefined,
          metadata: {
            status: task.status,
            priority: task.priority,
            assignedTo: task.assignedTo && typeof task.assignedTo === 'object' && 'name' in task.assignedTo
              ? {
                  id: (task.assignedTo as any)._id?.toString() || '',
                  name: (task.assignedTo as any).name || '',
                  profilePicture: (task.assignedTo as any).profilePicture,
                }
              : undefined,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          },
          score: exactMatch ? score + 50 : (allWordsMatch ? score + 25 : score), // Boost exact matches
        });
      }
    }
  }

  // Search Projects
  if (types.includes('project')) {
    const projectQuery: any = {
      ...workspaceQuery,
      ...createMongoQuery(['name', 'description']),
    };

    const projects = await ProjectModel.find(projectQuery)
      .populate('createdBy', 'name')
      .limit(limit * 2) // Get more to filter after
      .sort({ createdAt: -1 })
      .lean();

    for (const project of projects) {
      const nameLower = (project.name || '').toLowerCase();
      const descLower = ((project.description || '').toLowerCase());
      
      const exactMatch = nameLower.includes(lowerQuery) || descLower.includes(lowerQuery);
      const allWordsMatch = containsAllWords(project.name || '', query) || 
                           (project.description && containsAllWords(project.description, query));
      
      if (exactMatch || allWordsMatch || matchesPatterns(project.name || '', searchPatterns) || 
          (project.description && matchesPatterns(project.description, searchPatterns))) {
        const score = calculateScore(
          { title: project.name, description: project.description },
          query,
          'project'
        );
        results.push({
          type: 'project',
          id: project._id.toString(),
          title: project.name,
          description: project.description || undefined,
          metadata: {
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          },
          score: exactMatch ? score + 50 : (allWordsMatch ? score + 25 : score), // Boost exact matches
        });
      }
    }
  }

  // Sort by relevance score (highest first)
  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Apply pagination
  const paginatedResults = results.slice(offset, offset + limit);
  const totalCount = results.length;
  const hasMore = offset + paginatedResults.length < totalCount;

  return {
    results: paginatedResults,
    totalCount,
    hasMore,
  };
};

