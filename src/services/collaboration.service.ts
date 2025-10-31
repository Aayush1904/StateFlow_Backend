import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { UserDocument } from '../models/user.model';
import { createMentionNotificationService } from './notification.service';
import Page from '../models/page.model';
import Workspace from '../models/workspace.model';
import User from '../models/user.model';

interface AuthenticatedSocket extends Socket {
  user?: UserDocument;
}

export class CollaborationServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // workspaceId -> Set of userIds

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          process.env.CLIENT_URL || "http://localhost:5173",
          "https://state-flow-frontend.vercel.app"
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  // Method to emit activity events to workspace members
  public emitActivityEvent(workspaceId: string, activity: any) {
    this.io.to(`workspace:${workspaceId}`).emit('activity-update', {
      activity,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit task assignment notifications
  public emitTaskAssignmentNotification(assignedUserId: string, taskData: any) {
    this.io.to(`user:${assignedUserId}`).emit('task-assigned-notification', {
      type: 'task_assigned',
      title: taskData.title,
      message: taskData.message,
      taskId: taskData.taskId,
      workspaceId: taskData.workspaceId,
      projectId: taskData.projectId,
      projectName: taskData.projectName,
      assignedBy: taskData.assignedBy,
      assignedByUser: taskData.assignedByUser,
      priority: taskData.priority,
      status: taskData.status,
      dueDate: taskData.dueDate,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to notify project viewers about analytics updates
  public emitProjectAnalyticsUpdate(projectId: string, workspaceId?: string) {
    const payload = {
      projectId,
      workspaceId,
      timestamp: new Date().toISOString(),
    };

    this.io.to(`project:${projectId}`).emit('project-analytics-update', payload);

    if (workspaceId) {
      this.io.to(`workspace:${workspaceId}`).emit('project-analytics-update', payload);
    }
  }

  private async detectMentions(content: string, pageId: string, mentionedByUserId: string, mentionedByName: string) {
    try {
      // Extract mentions from HTML content using regex
      const mentionRegex = /<span[^>]*class="mention"[^>]*data-id="([^"]*)"[^>]*>@([^<]*)<\/span>/g;
      const mentions: string[] = [];
      let match;

      while ((match = mentionRegex.exec(content)) !== null) {
        const userId = match[1];
        const userName = match[2];
        if (userId && userId !== mentionedByUserId) {
          mentions.push(userId);
        }
      }

      if (mentions.length === 0) return;

      // Get page and workspace details
      const page = await Page.findById(pageId).populate('workspace', 'name');
      if (!page) return;

      const workspace = await Workspace.findById(page.workspace);
      if (!workspace) return;

      // Create notifications for each mention
      for (const mentionedUserId of mentions) {
        try {
          await createMentionNotificationService({
            mentionedUserId,
            mentionedByUserId,
            workspaceId: (workspace._id as any).toString(),
            pageId,
            pageTitle: page.title,
            workspaceName: workspace.name,
          });

          // Send real-time notification to the mentioned user
          this.io.to(`user:${mentionedUserId}`).emit('mention-notification', {
            type: 'mention',
            title: `You were mentioned by ${mentionedByName}`,
            message: `${mentionedByName} mentioned you in "${page.title}"`,
            pageId,
            workspaceId: (workspace._id as any).toString(),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error creating mention notification:', error);
        }
      }
    } catch (error) {
      console.error('Error detecting mentions:', error);
    }
  }

  private setupMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "development-secret"
        ) as any;

        // Support multiple possible JWT payload shapes
        const decodedUserId =
          decoded?.userId || decoded?._id || decoded?.id || decoded?.sub;

        // Fetch full user data from database using resolved id
        const user = decodedUserId ? await User.findById(decodedUserId) : null;
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        (socket as AuthenticatedSocket).user = user;
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(`User ${authSocket.user?.name} connected`);

      // Join user-specific room for notifications
      socket.join(`user:${authSocket.user!._id}`);

      // Join workspace room
      socket.on('join-workspace', (workspaceId: string) => {
        socket.join(`workspace:${workspaceId}`);
        
        // Track connected users
        if (!this.connectedUsers.has(workspaceId)) {
          this.connectedUsers.set(workspaceId, new Set());
        }
        this.connectedUsers.get(workspaceId)!.add(authSocket.user!._id as string as string);

        // Notify others about user presence
        socket.to(`workspace:${workspaceId}`).emit('user-joined', {
          userId: authSocket.user!._id as string as string,
          name: authSocket.user!.name,
          avatar: authSocket.user!.profilePicture,
        });

        // Send current users to the new user
        const currentUserIds = Array.from(this.connectedUsers.get(workspaceId) || []);
        socket.emit('current-users', currentUserIds);
      });

      // Join page room for real-time editing
      socket.on('join-page', (pageId: string) => {
        socket.join(`page:${pageId}`);
        const roomSize = this.io.sockets.adapter.rooms.get(`page:${pageId}`)?.size || 0;
        console.log(`[WS] User ${authSocket.user?.name} joined page ${pageId}, room size: ${roomSize}`);
      });

      // Join project room for analytics updates
      socket.on('join-project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        const roomSize = this.io.sockets.adapter.rooms.get(`project:${projectId}`)?.size || 0;
        console.log(`[WS] User ${authSocket.user?.name} joined project ${projectId}, room size: ${roomSize}`);
      });

      // Handle document updates
      socket.on('document-update', async (data: { pageId: string; update: any }) => {
        const room = this.io.sockets.adapter.rooms.get(`page:${data.pageId}`);
        const roomSize = room?.size || 0;
        const socketIds = room ? Array.from(room) : [];
        
        console.log(`[WS] Document update from ${authSocket.user?.name} (${socket.id}) on page ${data.pageId}`);
        console.log(`[WS] Room size: ${roomSize}, Socket IDs in room:`, socketIds);
        
        // Broadcast the update to other users in the same page room
        socket.to(`page:${data.pageId}`).emit('document-update', {
          update: data.update,
          userId: authSocket.user!._id as string,
          timestamp: new Date().toISOString(),
          socketId: socket.id,
        });

        console.log(`[WS] Broadcasted update to ${roomSize - 1} other socket(s)`);

        // Detect mentions in the content and send notifications
        if (data.update && data.update.content) {
          await this.detectMentions(
            data.update.content,
            data.pageId,
            authSocket.user!._id as string,
            authSocket.user!.name
          );
        }
      });

      // Handle cursor position updates
      socket.on('cursor-update', (data: { pageId: string; cursor: any }) => {
        socket.to(`page:${data.pageId}`).emit('cursor-update', {
          userId: authSocket.user!._id as string,
          name: authSocket.user!.name,
          avatar: authSocket.user!.profilePicture,
          cursor: data.cursor,
          socketId: socket.id,
        });
      });

      // Handle selection updates
      socket.on('selection-update', (data: { pageId: string; selection: any }) => {
        socket.to(`page:${data.pageId}`).emit('selection-update', {
          userId: authSocket.user!._id as string,
          name: authSocket.user!.name,
          avatar: authSocket.user!.profilePicture,
          selection: data.selection,
          socketId: socket.id,
        });
      });

      socket.on('whiteboard-update', (data: { pageId: string; stroke?: any; action?: 'clear' }) => {
        socket.to(`page:${data.pageId}`).emit('whiteboard-update', {
          stroke: data.stroke,
          action: data.action,
          userId: authSocket.user!._id as string,
          timestamp: new Date().toISOString(),
        });
      });

      // Leave workspace
      socket.on('leave-workspace', (workspaceId: string) => {
        socket.leave(`workspace:${workspaceId}`);
        
        // Remove from connected users
        const users = this.connectedUsers.get(workspaceId);
        if (users) {
          users.delete(authSocket.user!._id as string);
          if (users.size === 0) {
            this.connectedUsers.delete(workspaceId);
          }
        }

        // Notify others about user leaving
        socket.to(`workspace:${workspaceId}`).emit('user-left', {
          userId: authSocket.user!._id as string,
        });
      });

      // Leave page
      socket.on('leave-page', (pageId: string) => {
        socket.leave(`page:${pageId}`);
        const roomSize = this.io.sockets.adapter.rooms.get(`page:${pageId}`)?.size || 0;
        console.log(`[WS] User ${authSocket.user?.name} left page ${pageId}, room size: ${roomSize}`);
      });

      // Leave project room
      socket.on('leave-project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
        const roomSize = this.io.sockets.adapter.rooms.get(`project:${projectId}`)?.size || 0;
        console.log(`[WS] User ${authSocket.user?.name} left project ${projectId}, room size: ${roomSize}`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User ${authSocket.user?.name} disconnected`);
        
        // Remove from all workspaces
        this.connectedUsers.forEach((users, workspaceId) => {
          if (users.has(authSocket.user!._id as string)) {
            users.delete(authSocket.user!._id as string);
            if (users.size === 0) {
              this.connectedUsers.delete(workspaceId);
            }
            
            // Notify others about user leaving
            socket.to(`workspace:${workspaceId}`).emit('user-left', {
              userId: authSocket.user!._id as string,
            });
          }
        });
      });
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
