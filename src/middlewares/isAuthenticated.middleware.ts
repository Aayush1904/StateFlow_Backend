import { NextFunction, Request, Response } from "express";
import { UnauthorizedException } from "../utils/appError";
import { jwtAuth } from "./jwtAuth.middleware";

/**
 * Authentication middleware that supports both JWT and session-based authentication
 * First tries JWT from Authorization header, then falls back to session
 */
const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // First try JWT authentication (this will set req.user if token is valid)
    // We create a custom next function to intercept and check auth
    await new Promise<void>((resolve) => {
      jwtAuth(req, res, () => {
        // JWT middleware completed, now check authentication
        resolve();
      });
    });

    // After JWT check, verify user exists (either from JWT or session)
    if (!req.user || !req.user._id) {
      throw new UnauthorizedException("Unauthorized. Please log in.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default isAuthenticated;
