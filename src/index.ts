import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import session from "cookie-session";
import { createServer } from "http";
import { config } from "./config/app.config";
import connectDatabase from "./config/database.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { HTTPSTATUS } from "./config/http.config";
import { asyncHandler } from "./middlewares/asyncHandler.middleware";
import { BadRequestException } from "./utils/appError";
import { ErrorCodeEnum } from "./enums/error-code.enum";
import { CollaborationServer } from "./services/collaboration.service";
import { setCollaborationServer } from "./services/activity.service";
import { setCollaborationServer as setTaskCollaborationServer } from "./services/task.service";

import "./config/passport.config";
import passport from "passport";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import isAuthenticated from "./middlewares/isAuthenticated.middleware";
import workspaceRoutes from "./routes/workspace.route";
import memberRoutes from "./routes/member.route";
import projectRoutes from "./routes/project.route";
import taskRoutes from "./routes/task.route";
import pageRoutes from "./routes/page.route";
import pageTemplateRoutes from "./routes/pageTemplate.route";
import integrationRoutes from "./routes/integration.route";
import notificationRoutes from "./routes/notification.route";
import activityRoutes from "./routes/activity.route";
import commentRoutes from "./routes/comment.route";
import searchRoutes from "./routes/search.route";
import aiRoutes from "./routes/ai.route";

const app = express();
const BASE_PATH = config.BASE_PATH;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "session",
    keys: [config.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000,
    secure: config.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    origin: [config.FRONTEND_ORIGIN, "http://localhost:5173"],
    credentials: true,
  })
);

app.get(
  `/`,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    throw new BadRequestException(
      "This is a bad request",
      ErrorCodeEnum.AUTH_INVALID_TOKEN
    );
    return res.status(HTTPSTATUS.OK).json({
      message: "Hello Subscribe to the channel & share",
    });
  })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, isAuthenticated, userRoutes);
app.use(`${BASE_PATH}/workspace`, isAuthenticated, workspaceRoutes);
app.use(`${BASE_PATH}/member`, isAuthenticated, memberRoutes);
app.use(`${BASE_PATH}/project`, isAuthenticated, projectRoutes);
app.use(`${BASE_PATH}/task`, isAuthenticated, taskRoutes);
app.use(`${BASE_PATH}/page`, isAuthenticated, pageRoutes);
app.use(`${BASE_PATH}/page`, isAuthenticated, pageTemplateRoutes);
app.use(`${BASE_PATH}/integration`, isAuthenticated, integrationRoutes);
app.use(`${BASE_PATH}/notification`, notificationRoutes);
app.use(`${BASE_PATH}/workspace`, isAuthenticated, activityRoutes);
app.use(`${BASE_PATH}/comment`, isAuthenticated, commentRoutes);
app.use(`${BASE_PATH}/search`, isAuthenticated, searchRoutes);
app.use(`${BASE_PATH}/ai`, isAuthenticated, aiRoutes);

app.use(errorHandler);

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket collaboration server
const collaborationServer = new CollaborationServer(httpServer);

// Set collaboration server instance for activity service
setCollaborationServer(collaborationServer);

// Set collaboration server instance for task service
setTaskCollaborationServer(collaborationServer);

httpServer.listen(config.PORT, async () => {
  console.log(`Server listening on port ${config.PORT} in ${config.NODE_ENV}`);
  console.log(`WebSocket collaboration server initialized`);
  await connectDatabase();
});
