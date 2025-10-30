import mongoose from 'mongoose';
import PageModel from '../models/page.model';
import PageVersionModel from '../models/pageVersion.model';
import { NotFoundException, BadRequestException } from '../utils/appError';

export const createPageVersionService = async (
  pageId: string,
  userId: string,
  changeDescription?: string
) => {
  const page = await PageModel.findById(pageId);
  if (!page) {
    throw new NotFoundException('Page not found');
  }

  // Get the latest version number
  const latestVersion = await PageVersionModel.findOne({ pageId })
    .sort({ version: -1 })
    .select('version');

  const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

  // Create new version
  const version = new PageVersionModel({
    pageId: new mongoose.Types.ObjectId(pageId),
    version: newVersionNumber,
    title: page.title,
    content: page.content,
    createdBy: new mongoose.Types.ObjectId(userId),
    changeDescription: changeDescription || `Version ${newVersionNumber}`,
  });

  await version.save();

  return { version };
};

export const getPageVersionsService = async (pageId: string) => {
  const versions = await PageVersionModel.find({ pageId })
    .populate('createdBy', 'name email')
    .sort({ version: -1 });

  return { versions };
};

export const getPageVersionByIdService = async (versionId: string) => {
  const version = await PageVersionModel.findById(versionId)
    .populate('createdBy', 'name email')
    .populate('pageId', 'title');

  if (!version) {
    throw new NotFoundException('Version not found');
  }

  return { version };
};

export const restorePageVersionService = async (
  pageId: string,
  versionId: string,
  userId: string
) => {
  const page = await PageModel.findById(pageId);
  if (!page) {
    throw new NotFoundException('Page not found');
  }

  const version = await PageVersionModel.findById(versionId);
  if (!version) {
    throw new NotFoundException('Version not found');
  }

  if (version.pageId.toString() !== pageId) {
    throw new BadRequestException('Version does not belong to this page');
  }

  // Create a new version before restoring
  await createPageVersionService(pageId, userId, 'Restored from previous version');

  // Restore the page content
  page.title = version.title;
  page.content = version.content;
  page.updatedBy = new mongoose.Types.ObjectId(userId);

  await page.save();

  return { page, restoredVersion: version };
};

export const comparePageVersionsService = async (versionId1: string, versionId2: string) => {
  const [version1, version2] = await Promise.all([
    PageVersionModel.findById(versionId1),
    PageVersionModel.findById(versionId2),
  ]);

  if (!version1 || !version2) {
    throw new NotFoundException('One or both versions not found');
  }

  if (version1.pageId.toString() !== version2.pageId.toString()) {
    throw new BadRequestException('Cannot compare versions from different pages');
  }

  return {
    version1,
    version2,
    titleChanged: version1.title !== version2.title,
    contentChanged: version1.content !== version2.content,
  };
};
