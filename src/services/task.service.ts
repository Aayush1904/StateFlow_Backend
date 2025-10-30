import { TaskPriorityEnum, TaskStatusEnum } from "../enums/task.enum";
import MemberModel from "../models/member.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import User from "../models/user.model";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { createNotificationService } from "./notification.service";

// Import collaboration server instance
let collaborationServer: any = null;

export const setCollaborationServer = (server: any) => {
  collaborationServer = server;
};

export const createTaskService = async (
  workspaceId: string,
  projectId: string,
  userId: string,
  body: {
    title: string;
    description?: string;
    priority: string;
    status: string;
    assignedTo?: string | null;
    dueDate?: string;
  }
) => {
  const { title, description, priority, status, assignedTo, dueDate } = body;

  const project = await ProjectModel.findById(projectId);

  if (!project || project.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }
  if (assignedTo) {
    const isAssignedUserMember = await MemberModel.exists({
      userId: assignedTo,
      workspaceId,
    });

    if (!isAssignedUserMember) {
      throw new Error("Assigned user is not a member of this workspace.");
    }
  }
  const task = new TaskModel({
    title,
    description,
    priority: priority || TaskPriorityEnum.MEDIUM,
    status: status || TaskStatusEnum.TODO,
    assignedTo,
    createdBy: userId,
    workspace: workspaceId,
    project: projectId,
    dueDate,
  });

  await task.save();

  if (collaborationServer) {
    try {
      collaborationServer.emitProjectAnalyticsUpdate(projectId, workspaceId);
    } catch (error) {
      console.error('Failed to emit project analytics update after task creation:', error);
    }
  }

  // Create notification for task assignment
  if (assignedTo && assignedTo !== userId) {
    try {
      const assignedUser = await User.findById(assignedTo);
      const creatorUser = await User.findById(userId);
      
      if (assignedUser && creatorUser) {
        await createNotificationService({
          userId: assignedTo,
          workspaceId,
          type: 'task_assigned',
          title: 'New task assigned to you',
          message: `${creatorUser.name} assigned you a new task: "${title}"`,
          data: {
            taskId: task._id,
            taskTitle: title,
            assignedBy: userId,
            assignedByUser: {
              _id: creatorUser._id,
              name: creatorUser.name,
              email: creatorUser.email,
              profilePicture: creatorUser.profilePicture,
            },
            projectId,
            projectName: project.name,
            priority,
            status,
            dueDate,
          },
        });

        // Emit real-time notification
        if (collaborationServer) {
          collaborationServer.emitTaskAssignmentNotification(assignedTo, {
            title: 'New task assigned to you',
            message: `${creatorUser.name} assigned you a new task: "${title}"`,
            taskId: task._id,
            workspaceId,
            projectId,
            projectName: project.name,
            assignedBy: userId,
            assignedByUser: {
              _id: creatorUser._id,
              name: creatorUser.name,
              email: creatorUser.email,
              profilePicture: creatorUser.profilePicture,
            },
            priority,
            status,
            dueDate,
          });
        }
      }
    } catch (error) {
      console.error('Failed to create task assignment notification:', error);
      // Don't throw error to avoid breaking task creation
    }
  }

  return { task };
};

export const updateTaskService = async (
  workspaceId: string,
  projectId: string,
  taskId: string,
  userId: string,
  body: {
    title: string;
    description?: string;
    priority: string;
    status: string;
    assignedTo?: string | null;
    dueDate?: string;
  }
) => {
  const project = await ProjectModel.findById(projectId);

  if (!project || project.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }

  const task = await TaskModel.findById(taskId);

  if (!task || task.project.toString() !== projectId.toString()) {
    throw new NotFoundException(
      "Task not found or does not belong to this project"
    );
  }

  const oldAssignedTo = task.assignedTo?.toString();
  const newAssignedTo = body.assignedTo;

  const updatedTask = await TaskModel.findByIdAndUpdate(
    taskId,
    {
      ...body,
    },
    { new: true }
  );

  if (!updatedTask) {
    throw new BadRequestException("Failed to update task");
  }

  if (collaborationServer) {
    try {
      collaborationServer.emitProjectAnalyticsUpdate(projectId, workspaceId);
    } catch (error) {
      console.error('Failed to emit project analytics update after task update:', error);
    }
  }

  // Create notification for task assignment change
  if (newAssignedTo && newAssignedTo !== oldAssignedTo && newAssignedTo !== userId) {
    try {
      const assignedUser = await User.findById(newAssignedTo);
      const updaterUser = await User.findById(userId);
      
      if (assignedUser && updaterUser) {
        await createNotificationService({
          userId: newAssignedTo,
          workspaceId,
          type: 'task_assigned',
          title: 'Task assigned to you',
          message: `${updaterUser.name} assigned you task: "${task.title}"`,
          data: {
            taskId: task._id,
            taskTitle: task.title,
            assignedBy: userId,
            assignedByUser: {
              _id: updaterUser._id,
              name: updaterUser.name,
              email: updaterUser.email,
              profilePicture: updaterUser.profilePicture,
            },
            projectId,
            projectName: project.name,
            priority: body.priority,
            status: body.status,
            dueDate: body.dueDate,
            isReassignment: oldAssignedTo ? true : false,
          },
        });

        // Emit real-time notification
        if (collaborationServer) {
          collaborationServer.emitTaskAssignmentNotification(newAssignedTo, {
            title: 'Task assigned to you',
            message: `${updaterUser.name} assigned you task: "${task.title}"`,
            taskId: task._id,
            workspaceId,
            projectId,
            projectName: project.name,
            assignedBy: userId,
            assignedByUser: {
              _id: updaterUser._id,
              name: updaterUser.name,
              email: updaterUser.email,
              profilePicture: updaterUser.profilePicture,
            },
            priority: body.priority,
            status: body.status,
            dueDate: body.dueDate,
            isReassignment: oldAssignedTo ? true : false,
          });
        }
      }
    } catch (error) {
      console.error('Failed to create task assignment notification:', error);
      // Don't throw error to avoid breaking task update
    }
  }

  return { updatedTask };
};

export const getAllTasksService = async (
  workspaceId: string,
  filters: {
    projectId?: string;
    status?: string[];
    priority?: string[];
    assignedTo?: string[];
    keyword?: string;
    dueDate?: string;
  },
  pagination: {
    pageSize: number;
    pageNumber: number;
  }
) => {
  const query: Record<string, any> = {
    workspace: workspaceId,
  };

  if (filters.projectId) {
    query.project = filters.projectId;
  }

  if (filters.status && filters.status?.length > 0) {
    query.status = { $in: filters.status };
  }

  if (filters.priority && filters.priority?.length > 0) {
    query.priority = { $in: filters.priority };
  }

  if (filters.assignedTo && filters.assignedTo?.length > 0) {
    query.assignedTo = { $in: filters.assignedTo };
  }

  if (filters.keyword && filters.keyword !== undefined) {
    query.title = { $regex: filters.keyword, $options: "i" };
  }

  if (filters.dueDate) {
    query.dueDate = {
      $eq: new Date(filters.dueDate),
    };
  }

  //Pagination Setup
  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [tasks, totalCount] = await Promise.all([
    TaskModel.find(query)
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .populate("assignedTo", "_id name profilePicture -password")
      .populate("project", "_id emoji name"),
    TaskModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    tasks,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip,
    },
  };
};

export const getTaskByIdService = async (
  workspaceId: string,
  projectId: string,
  taskId: string
) => {
  const project = await ProjectModel.findById(projectId);

  if (!project || project.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }

  const task = await TaskModel.findOne({
    _id: taskId,
    workspace: workspaceId,
    project: projectId,
  }).populate("assignedTo", "_id name profilePicture -password");

  if (!task) {
    throw new NotFoundException("Task not found.");
  }

  return task;
};

export const deleteTaskService = async (
  workspaceId: string,
  taskId: string
) => {
  const task = await TaskModel.findOneAndDelete({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) {
    throw new NotFoundException(
      "Task not found or does not belong to the specified workspace"
    );
  }

  if (collaborationServer) {
    try {
      collaborationServer.emitProjectAnalyticsUpdate(
        task.project.toString(),
        workspaceId
      );
    } catch (error) {
      console.error('Failed to emit project analytics update after task deletion:', error);
    }
  }

  return;
};
