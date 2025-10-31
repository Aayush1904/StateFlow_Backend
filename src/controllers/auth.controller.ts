import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { config } from "../config/app.config";
import { registerSchema } from "../validation/auth.validation";
import { HTTPSTATUS } from "../config/http.config";
import { registerUserService } from "../services/auth.service";
import passport from "passport";
import jwt from "jsonwebtoken";

export const googleLoginCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const currentWorkspace = req.user?.currentWorkspace;

    if (!currentWorkspace || !req.user) {
      return res.redirect(
        `${config.FRONTEND_GOOGLE_CALLBACK_URL}?status=failure`
      );
    }

    // Issue JWT token for the user
    const token = jwt.sign(
      {
        _id: (req.user as any)._id,
        name: (req.user as any).name,
        email: (req.user as any).email,
        profilePicture: (req.user as any).profilePicture,
      },
      process.env.JWT_SECRET || "development-secret",
      { expiresIn: "7d" }
    );

    const frontendUrl = config.FRONTEND_ORIGIN.startsWith('http') 
      ? config.FRONTEND_ORIGIN 
      : `https://${config.FRONTEND_ORIGIN}`;
    
    // Redirect with token in URL so frontend can extract and store it
    return res.redirect(
      `${frontendUrl}/workspace/${currentWorkspace}?token=${token}`
    );
  }
);

export const registerUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = registerSchema.parse({
      ...req.body,
    });

    await registerUserService(body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "User created successfully",
    });
  }
);

export const loginController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log(`Login attempt for email: ${req.body.email}`);
    
    passport.authenticate(
      "local",
      (
        err: Error | null,
        user: Express.User | false,
        info: { message: string } | undefined
      ) => {
        console.log(`Passport authenticate result - err:`, err ? "Yes" : "No", "user:", user ? "Yes" : "No", "info:", info?.message);
        
        if (err) {
          console.log(`Passport error:`, err.message);
          return next(err);
        }

        if (!user) {
          console.log(`No user returned from passport`);
          return res.status(HTTPSTATUS.UNAUTHORIZED).json({
            message: info?.message || "Invalid email or password",
          });
        }

        console.log(`User found, attempting to log in session`);
        req.logIn(user, (err) => {
          if (err) {
            console.log(`Session login error:`, err.message);
            return next(err);
          }

          console.log(`Login successful for user:`, user.email);
          // Issue JWT for websocket authentication
          const token = jwt.sign(
            {
              _id: (user as any)._id,
              name: (user as any).name,
              email: (user as any).email,
              profilePicture: (user as any).profilePicture,
            },
            process.env.JWT_SECRET || "development-secret",
            { expiresIn: "7d" }
          );
          return res.status(HTTPSTATUS.OK).json({
            message: "Logged in successfully",
            user,
            token,
          });
        });
      }
    )(req, res, next);
  }
);

export const logOutController = asyncHandler(
  async (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res
          .status(HTTPSTATUS.INTERNAL_SERVER_ERROR)
          .json({ error: "Failed to log out" });
      }
    });

    req.session = null;
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Logged out successfully" });
  }
);
