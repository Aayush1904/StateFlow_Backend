import mongoose from 'mongoose';
import PageModel from '../models/page.model';
import PageTemplateModel from '../models/pageTemplate.model';
import { NotFoundException, BadRequestException } from '../utils/appError';

export const createPageService = async (
  workspaceId: string,
  userId: string,
  body: {
    title: string;
    content?: string;
    projectId?: string;
    parentId?: string;
    isPublished?: boolean;
    templateId?: string;
  }
) => {
  const { title, content, projectId, parentId, isPublished = false, templateId } = body;

  let initialContent = content || '';

  // If templateId is provided, try to use template content as fallback if content is empty or just whitespace
  // This allows users to edit the template content in the editor and have their edits saved
  if (templateId && (!content || content.trim() === '')) {
    try {
      // Validate templateId is a valid ObjectId format
      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        console.warn(`Invalid templateId format: ${templateId}`);
      } else {
        const template = await PageTemplateModel.findById(templateId);
        if (!template) {
          // Log warning but don't fail - allow page creation without template content
          console.warn(`Template ${templateId} not found, proceeding without template content`);
        } else {
          // Verify template is accessible (workspace-specific or default)
          const isAccessible = 
            template.isDefault || 
            (template.workspace && template.workspace.toString() === workspaceId);
          
          if (!isAccessible) {
            console.warn(`Template ${templateId} is not accessible in workspace ${workspaceId}`);
            // Don't throw error, just log and continue with empty content
          } else {
            initialContent = template.content || '';
          }
        }
      }
    } catch (error) {
      // Log error but don't fail page creation
      console.error('Error fetching template:', error);
      // Continue with empty or existing content
    }
  }

  // Generate slug from title
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // If slug is empty (e.g., title contains only special characters), generate a fallback
  if (!slug || slug.trim() === '') {
    slug = `page-${Date.now()}`;
  }

  // Check if slug already exists in this workspace, if so append a number
  let finalSlug = slug;
  let counter = 1;
  while (true) {
    const existingPage = await PageModel.findOne({ 
      slug: finalSlug,
      workspace: new mongoose.Types.ObjectId(workspaceId)
    });
    if (!existingPage) {
      break;
    }
    finalSlug = `${slug}-${counter}`;
    counter++;
    // Prevent infinite loop (max 1000 attempts)
    if (counter > 1000) {
      finalSlug = `${slug}-${Date.now()}`;
      break;
    }
  }

  const page = new PageModel({
    title,
    content: initialContent,
    workspace: new mongoose.Types.ObjectId(workspaceId),
    project: projectId ? new mongoose.Types.ObjectId(projectId) : null,
    parent: parentId ? new mongoose.Types.ObjectId(parentId) : null,
    slug: finalSlug,
    createdBy: new mongoose.Types.ObjectId(userId),
    updatedBy: new mongoose.Types.ObjectId(userId),
    isPublished,
  });

  await page.save();

  return { page };
};

export const getPageByIdService = async (pageId: string) => {
  const page = await PageModel.findById(pageId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('project', 'name emoji')
    .populate('parent', 'title slug');

  if (!page) {
    throw new NotFoundException('Page not found');
  }

  return { page };
};

export const getPagesByWorkspaceService = async (
  workspaceId: string,
  projectId?: string,
  parentId?: string
) => {
  const query: any = { workspace: new mongoose.Types.ObjectId(workspaceId) };

  if (projectId) {
    query.project = new mongoose.Types.ObjectId(projectId);
  }

  if (parentId) {
    query.parent = new mongoose.Types.ObjectId(parentId);
  } else if (parentId === null) {
    query.parent = null; // Root pages
  }

  const pages = await PageModel.find(query)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('project', 'name emoji')
    .populate('parent', 'title slug')
    .sort({ createdAt: -1 });

  return { pages };
};

export const updatePageService = async (
  pageId: string,
  userId: string,
  body: {
    title?: string;
    content?: string;
    isPublished?: boolean;
  }
) => {
  const { title, content, isPublished } = body;

  const page = await PageModel.findById(pageId);
  if (!page) {
    throw new NotFoundException('Page not found');
  }

  // If title is being updated, generate new slug
  if (title && title !== page.title) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if new slug already exists
    const existingPage = await PageModel.findOne({ slug, _id: { $ne: pageId } });
    if (existingPage) {
      throw new BadRequestException('A page with this title already exists');
    }

    page.slug = slug;
    page.title = title;
  }

  if (content !== undefined) {
    page.content = content;
  }

  if (isPublished !== undefined) {
    page.isPublished = isPublished;
  }

  page.updatedBy = new mongoose.Types.ObjectId(userId);

  await page.save();

  return { page };
};

export const deletePageService = async (pageId: string) => {
  const page = await PageModel.findById(pageId);
  if (!page) {
    throw new NotFoundException('Page not found');
  }

  // Check if page has children
  const childPages = await PageModel.find({ parent: new mongoose.Types.ObjectId(pageId) });
  if (childPages.length > 0) {
    throw new BadRequestException('Cannot delete page with child pages');
  }

  await PageModel.findByIdAndDelete(pageId);

  return { message: 'Page deleted successfully' };
};
