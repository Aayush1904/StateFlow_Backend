import { ActivityModel, IActivity } from '../models/activity.model';
import User from '../models/user.model';
import { NotFoundException, BadRequestException } from '../utils/appError';

// Import collaboration server instance
let collaborationServer: any = null;

export const setCollaborationServer = (server: any) => {
  collaborationServer = server;
};

export interface CreateActivityData {
  workspaceId: string;
  userId: string;
  type: IActivity['type'];
  title: string;
  description: string;
  resourceType: IActivity['resourceType'];
  resourceId?: string;
  resourceName?: string;
  projectId?: string;
  projectName?: string;
  data?: any;
}

export interface ActivityFilters {
  userId?: string;
  resourceType?: string;
  projectId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export const createActivityService = async (data: CreateActivityData) => {
  try {
    // Get user details
    const user = await User.findById(data.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create activity
    const activity = new ActivityModel({
      ...data,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });

    await activity.save();

    // Emit real-time activity event
    if (collaborationServer) {
      try {
        collaborationServer.emitActivityEvent(data.workspaceId, activity);
      } catch (error) {
        console.error('Failed to emit activity event:', error);
      }
    }

    return { activity };
  } catch (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
};

export const getActivitiesByWorkspaceService = async (
  workspaceId: string,
  filters: ActivityFilters = {}
) => {
  try {
    const {
      userId,
      resourceType,
      projectId,
      type,
      limit = 50,
      offset = 0,
    } = filters;

    // Build query
    const query: any = { workspaceId };

    if (userId) query.userId = userId;
    if (resourceType) query.resourceType = resourceType;
    if (projectId) query.projectId = projectId;
    if (type) query.type = type;

    // Get activities with pagination
    const activities = await ActivityModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    // Get total count for pagination
    const totalCount = await ActivityModel.countDocuments(query);

    return {
      activities,
      totalCount,
      hasMore: offset + activities.length < totalCount,
    };
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
};

export const getActivityByIdService = async (activityId: string) => {
  try {
    const activity = await ActivityModel.findById(activityId);
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return { activity };
  } catch (error) {
    console.error('Error fetching activity:', error);
    throw error;
  }
};

export const deleteActivityService = async (activityId: string) => {
  try {
    const activity = await ActivityModel.findByIdAndDelete(activityId);
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return { activity };
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
};

// Helper function to create activity for different resource types
export const createPageActivity = async (
  workspaceId: string,
  userId: string,
  type: 'page_created' | 'page_updated' | 'page_deleted',
  pageId: string,
  pageTitle: string,
  projectId?: string,
  projectName?: string,
  data?: any
) => {
  const titles = {
    page_created: 'Created page',
    page_updated: 'Updated page',
    page_deleted: 'Deleted page',
  };

  let description = '';
  
  switch (type) {
    case 'page_created':
      description = `Created page "${pageTitle}"`;
      if (projectName && projectName !== 'No Project') {
        description += ` in project "${projectName}"`;
      }
      break;
    case 'page_updated':
      description = `Updated page "${pageTitle}"`;
      if (projectName && projectName !== 'No Project') {
        description += ` in project "${projectName}"`;
      }
      if (data?.titleChanged && data?.contentChanged) {
        description += ' (title and content changed)';
      } else if (data?.titleChanged) {
        description += ' (title changed)';
      } else if (data?.contentChanged) {
        description += ' (content changed)';
      }
      break;
    case 'page_deleted':
      description = `Deleted page "${pageTitle}"`;
      if (projectName && projectName !== 'No Project') {
        description += ` from project "${projectName}"`;
      }
      break;
  }

  return createActivityService({
    workspaceId,
    userId,
    type,
    title: titles[type],
    description,
    resourceType: 'page',
    resourceId: pageId,
    resourceName: pageTitle,
    projectId,
    projectName,
    data,
  });
};

export const createTaskActivity = async (
  workspaceId: string,
  userId: string,
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'task_moved',
  taskId: string,
  taskTitle: string,
  projectId: string,
  projectName: string,
  data?: any
) => {
  const titles = {
    task_created: 'Created task',
    task_updated: 'Updated task',
    task_deleted: 'Deleted task',
    task_moved: 'Moved task',
  };

  let description = '';
  
  switch (type) {
    case 'task_created':
      description = `Created task "${taskTitle}" in project "${projectName}"`;
      if (data?.priority) {
        description += ` with ${data.priority} priority`;
      }
      if (data?.status) {
        description += ` in ${data.status} status`;
      }
      break;
    case 'task_updated':
      description = `Updated task "${taskTitle}" in project "${projectName}"`;
      if (data?.changes) {
        const changes = Object.keys(data.changes).filter(key => 
          data.changes[key] !== undefined && data.changes[key] !== null && data.changes[key] !== ''
        );
        if (changes.length > 0) {
          description += ` (${changes.join(', ')} changed)`;
        }
      }
      break;
    case 'task_deleted':
      description = `Deleted task "${taskTitle}" from project "${projectName}"`;
      break;
    case 'task_moved':
      description = `Moved task "${taskTitle}" from ${data?.oldStatus || 'unknown'} to ${data?.newStatus || 'unknown'} in project "${projectName}"`;
      break;
  }

  return createActivityService({
    workspaceId,
    userId,
    type,
    title: titles[type],
    description,
    resourceType: 'task',
    resourceId: taskId,
    resourceName: taskTitle,
    projectId,
    projectName,
    data,
  });
};

export const createProjectActivity = async (
  workspaceId: string,
  userId: string,
  type: 'project_created' | 'project_updated' | 'project_deleted',
  projectId: string,
  projectName: string,
  data?: any
) => {
  const titles = {
    project_created: 'Created project',
    project_updated: 'Updated project',
    project_deleted: 'Deleted project',
  };

  let description = '';
  
  switch (type) {
    case 'project_created':
      description = `Created project "${projectName}"`;
      if (data?.emoji) {
        description += ` ${data.emoji}`;
      }
      if (data?.description) {
        description += ` - ${data.description}`;
      }
      break;
    case 'project_updated':
      description = `Updated project "${projectName}"`;
      if (data?.changes) {
        const changes = Object.keys(data.changes).filter(key => 
          data.changes[key] !== undefined && data.changes[key] !== null && data.changes[key] !== ''
        );
        if (changes.length > 0) {
          description += ` (${changes.join(', ')} changed)`;
        }
      }
      break;
    case 'project_deleted':
      description = `Deleted project "${projectName}"`;
      break;
  }

  return createActivityService({
    workspaceId,
    userId,
    type,
    title: titles[type],
    description,
    resourceType: 'project',
    resourceId: projectId,
    resourceName: projectName,
    projectId,
    projectName,
    data,
  });
};

export const createMemberActivity = async (
  workspaceId: string,
  userId: string,
  type: 'member_added' | 'member_removed' | 'member_role_changed',
  memberId: string,
  memberName: string,
  data?: any
) => {
  const titles = {
    member_added: 'Added member',
    member_removed: 'Removed member',
    member_role_changed: 'Changed member role',
  };

  const descriptions = {
    member_added: `Added "${memberName}" to workspace`,
    member_removed: `Removed "${memberName}" from workspace`,
    member_role_changed: `Changed role for "${memberName}"`,
  };

  return createActivityService({
    workspaceId,
    userId,
    type,
    title: titles[type],
    description: descriptions[type],
    resourceType: 'member',
    resourceId: memberId,
    resourceName: memberName,
    data,
  });
};
