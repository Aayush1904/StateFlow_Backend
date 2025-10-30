import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createTaskSchema,
  taskIdSchema,
  updateTaskSchema,
} from "../validation/task.validation";
import { projectIdSchema } from "../validation/project.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";
import { Permissions } from "../enums/role.enum";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { roleGuard } from "../utils/roleGuard";
import {
  createTaskService,
  deleteTaskService,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
} from "../services/task.service";
import { HTTPSTATUS } from "../config/http.config";
import { createTaskActivity } from "../services/activity.service";
import ProjectModel from "../models/project.model";

export const createTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const body = createTaskSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_TASK]);

    const { task } = await createTaskService(
      workspaceId,
      projectId,
      userId,
      body
    );

    // Log activity
    try {
      const project = await ProjectModel.findById(projectId);
      await createTaskActivity(
        workspaceId,
        userId,
        'task_created',
        String(task._id),
        task.title,
        projectId,
        project?.name || 'Unknown Project',
        { priority: task.priority, status: task.status }
      );
    } catch (error) {
      console.error('Failed to log task creation activity:', error);
    }

    return res.status(HTTPSTATUS.OK).json({
      message: "Task created successfully",
      task,
    });
  }
);

export const updateTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const body = updateTaskSchema.parse(req.body);

    const taskId = taskIdSchema.parse(req.params.id);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const { updatedTask } = await updateTaskService(
      workspaceId,
      projectId,
      taskId,
      userId,
      body
    );

    // Log activity
    try {
      const project = await ProjectModel.findById(projectId);
      await createTaskActivity(
        workspaceId,
        userId,
        'task_updated',
        taskId,
        updatedTask.title,
        projectId,
        project?.name || 'Unknown Project',
        { 
          changes: body
        }
      );
    } catch (error) {
      console.error('Failed to log task update activity:', error);
    }

    return res.status(HTTPSTATUS.OK).json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  }
);

export const getAllTasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const filters = {
      projectId: req.query.projectId as string | undefined,
      status: req.query.status
        ? (req.query.status as string)?.split(",")
        : undefined,
      priority: req.query.priority
        ? (req.query.priority as string)?.split(",")
        : undefined,
      assignedTo: req.query.assignedTo
        ? (req.query.assignedTo as string)?.split(",")
        : undefined,
      keyword: req.query.keyword as string | undefined,
      dueDate: req.query.dueDate as string | undefined,
    };

    const pagination = {
      pageSize: parseInt(req.query.pageSize as string) || 10,
      pageNumber: parseInt(req.query.pageNumber as string) || 1,
    };

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getAllTasksService(workspaceId, filters, pagination);

    return res.status(HTTPSTATUS.OK).json({
      message: "All tasks fetched successfully",
      ...result,
    });
  }
);

export const getTaskByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const taskId = taskIdSchema.parse(req.params.id);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const task = await getTaskByIdService(workspaceId, projectId, taskId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Task fetched successfully",
      task,
    });
  }
);

export const deleteTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_TASK]);

    // Get task details before deletion for activity logging
    const task = await getTaskByIdService(workspaceId, '', taskId);

    await deleteTaskService(workspaceId, taskId);

    // Log activity
    try {
      const project = await ProjectModel.findById(task.project);
      await createTaskActivity(
        workspaceId,
        userId,
        'task_deleted',
        taskId,
        task.title,
        (task.project as any)?.toString() || '',
        project?.name || 'Unknown Project'
      );
    } catch (error) {
      console.error('Failed to log task deletion activity:', error);
    }

    return res.status(HTTPSTATUS.OK).json({
      message: "Task deleted successfully",
    });
  }
);

export const moveTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const taskId = taskIdSchema.parse(req.params.id);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    
    const { newStatus, oldStatus } = req.body;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    // Get task details before update
    const task = await getTaskByIdService(workspaceId, projectId, taskId);
    
    // Update task status
    const { updatedTask } = await updateTaskService(
      workspaceId,
      projectId,
      taskId,
      userId,
      {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: newStatus,
        assignedTo: task.assignedTo?._id ? String(task.assignedTo._id) : null,
        dueDate: task.dueDate ? (typeof task.dueDate === 'string' ? task.dueDate : task.dueDate.toISOString()) : '',
      }
    );

    // Log activity for task movement
    try {
      const project = await ProjectModel.findById(projectId);
      await createTaskActivity(
        workspaceId,
        userId,
        'task_moved',
        taskId,
        updatedTask.title,
        projectId,
        project?.name || 'Unknown Project',
        { 
          oldStatus,
          newStatus,
          oldColumn: oldStatus,
          newColumn: newStatus
        }
      );
    } catch (error) {
      console.error('Failed to log task movement activity:', error);
    }

    return res.status(HTTPSTATUS.OK).json({
      message: "Task moved successfully",
      task: updatedTask,
    });
  }
);
