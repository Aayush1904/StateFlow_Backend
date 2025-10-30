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

  // If templateId is provided but no content was submitted, use template content as fallback
  // This allows users to edit the template content in the editor and have their edits saved
  if (templateId && !content) {
    const template = await PageTemplateModel.findById(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Verify template is accessible (workspace-specific or default)
    const isAccessible = 
      template.isDefault || 
      (template.workspace && template.workspace.toString() === workspaceId);
    
    if (!isAccessible) {
      throw new BadRequestException('Template is not accessible in this workspace');
    }

    initialContent = template.content;
  }

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Check if slug already exists
  const existingPage = await PageModel.findOne({ slug });
  if (existingPage) {
    throw new BadRequestException('A page with this title already exists');
  }

  const page = new PageModel({
    title,
    content: initialContent,
    workspace: new mongoose.Types.ObjectId(workspaceId),
    project: projectId ? new mongoose.Types.ObjectId(projectId) : null,
    parent: parentId ? new mongoose.Types.ObjectId(parentId) : null,
    slug,
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
