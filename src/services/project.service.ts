import mongoose from "mongoose";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import { NotFoundException } from "../utils/appError";
import { TaskStatusEnum } from "../enums/task.enum";

export const createProjectService = async (
  userId: string,
  workspaceId: string,
  body: {
    emoji?: string;
    name: string;
    description?: string;
  }
) => {
  const project = new ProjectModel({
    ...(body.emoji && { emoji: body.emoji }),
    name: body.name,
    description: body.description,
    workspace: workspaceId,
    createdBy: userId,
  });

  await project.save();

  return { project };
};

export const getProjectsInWorkspaceService = async (
  workspaceId: string,
  pageSize: number,
  pageNumber: number
) => {
  // Step 1: Find all projects in the workspace

  const totalCount = await ProjectModel.countDocuments({
    workspace: workspaceId,
  });

  const skip = (pageNumber - 1) * pageSize;

  const projects = await ProjectModel.find({
    workspace: workspaceId,
  })
    .skip(skip)
    .limit(pageSize)
    .populate("createdBy", "_id name profilePicture -password")
    .sort({ createdAt: -1 });

  const totalPages = Math.ceil(totalCount / pageSize);

  return { projects, totalCount, totalPages, skip };
};

export const getProjectByIdAndWorkspaceIdService = async (
  workspaceId: string,
  projectId: string
) => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  }).select("_id emoji name description");

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to the specified workspace"
    );
  }

  return { project };
};

export const getProjectAnalyticsService = async (
  workspaceId: string,
  projectId: string
) => {
  const project = await ProjectModel.findById(projectId);

  if (!project || project.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }

  const currentDate = new Date();

  const tasks = await TaskModel.find({
    project: new mongoose.Types.ObjectId(projectId),
    workspace: new mongoose.Types.ObjectId(workspaceId),
  })
    .populate("assignedTo", "_id name profilePicture")
    .select("title status assignedTo createdAt updatedAt dueDate")
    .sort({ createdAt: 1 })
    .lean();

  const formatDateKeyUTC = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const totalTasks = tasks.length;

  const statusValues = Object.values(TaskStatusEnum);
  const statusCounts: Record<string, number> = {};
  statusValues.forEach((status) => {
    statusCounts[status] = 0;
  });

  let overdueTasksCount = 0;
  let completedTasksCount = 0;

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  tasks.forEach((task: any) => {
    const status = task.status as string;
    if (statusCounts[status] !== undefined) {
      statusCounts[status] += 1;
    }

    if (task.dueDate && status !== TaskStatusEnum.DONE) {
      const dueDate = new Date(task.dueDate);
      if (dueDate < currentDate) {
        overdueTasksCount += 1;
      }
    }

    if (status === TaskStatusEnum.DONE) {
      completedTasksCount += 1;
    }
  });

  const completionRate = totalTasks
    ? Math.round((completedTasksCount / totalTasks) * 100)
    : 0;

  const overview = {
    totalTasks,
    completedTasks: completedTasksCount,
    overdueTasks: overdueTasksCount,
    completionRate,
  };

  const statusBreakdown = statusValues.map((status) => ({
    status,
    count: statusCounts[status] || 0,
  }));

  const userTaskCount = new Map<
    string,
    { userId: string; name: string; avatar: string | null; taskCount: number }
  >();

  tasks.forEach((task: any) => {
    const assignee = task.assignedTo;
    if (!assignee || !assignee._id) {
      return;
    }

    const userId = assignee._id.toString();
    if (!userTaskCount.has(userId)) {
      userTaskCount.set(userId, {
        userId,
        name: assignee.name || "Unassigned",
        avatar: assignee.profilePicture ?? null,
        taskCount: 0,
      });
    }

    userTaskCount.get(userId)!.taskCount += 1;
  });

  const mostActiveUsers = Array.from(userTaskCount.values())
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 5);

  const daysWindow = 14;
  const dateBuckets = new Map<string, { date: string; created: number; completed: number }>();

  for (let i = daysWindow - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - i);
    const key = formatDateKeyUTC(day);
    dateBuckets.set(key, { date: key, created: 0, completed: 0 });
  }

  tasks.forEach((task: any) => {
    const createdKey = formatDateKeyUTC(new Date(task.createdAt));
    if (dateBuckets.has(createdKey)) {
      dateBuckets.get(createdKey)!.created += 1;
    }

    if (task.status === TaskStatusEnum.DONE) {
      const completedKey = formatDateKeyUTC(new Date(task.updatedAt));
      if (dateBuckets.has(completedKey)) {
        dateBuckets.get(completedKey)!.completed += 1;
      }
    }
  });

  const taskTrends = Array.from(dateBuckets.values());

  const statusProgressMap: Record<string, number> = {
    [TaskStatusEnum.BACKLOG]: 0.1,
    [TaskStatusEnum.TODO]: 0.2,
    [TaskStatusEnum.IN_PROGRESS]: 0.5,
    [TaskStatusEnum.IN_REVIEW]: 0.75,
    [TaskStatusEnum.DONE]: 1,
  };

  const timeline = tasks
    .map((task: any) => {
      const startDate = new Date(task.createdAt);
      const endDate = task.dueDate
        ? new Date(task.dueDate)
        : addDays(new Date(task.createdAt), 7);

      const assignee = task.assignedTo;

      return {
        taskId: task._id.toString(),
        title: task.title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: task.status as string,
        progress: statusProgressMap[task.status as string] ?? 0,
        durationDays: Math.max(
          1,
          Math.round(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        ),
        assignee: assignee && assignee._id
          ? {
              userId: assignee._id.toString(),
              name: assignee.name || "Unassigned",
              avatar: assignee.profilePicture ?? null,
            }
          : null,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );

  return {
    analytics: {
      overview,
      statusBreakdown,
      mostActiveUsers,
      taskTrends,
      timeline,
    },
  };
};

export const updateProjectService = async (
  workspaceId: string,
  projectId: string,
  body: {
    emoji?: string;
    name: string;
    description?: string;
  }
) => {
  const { name, emoji, description } = body;

  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  });

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to the specified workspace"
    );
  }

  if (emoji) project.emoji = emoji;
  if (name) project.name = name;
  if (description) project.description = description;

  await project.save();

  return { project };
};

export const deleteProjectService = async (
  workspaceId: string,
  projectId: string
) => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  });

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to the specified workspace"
    );
  }

  await project.deleteOne();

  await TaskModel.deleteMany({
    project: project._id,
  });

  return project;
};
