import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../models/user.model";

/**
 * Middleware to authenticate users using JWT tokens from Authorization header
 * Sets req.user if token is valid. Does not call next() - caller must handle it.
 */
export const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip if user is already authenticated via session
  if (req.user) {
    return next();
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(); // No JWT token, let session auth handle it
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "development-secret"
    ) as any;

    // Extract user ID from token (support multiple possible payload shapes)
    const userId = decoded?._id || decoded?.userId || decoded?.id || decoded?.sub;
    
    if (!userId) {
      return next(); // Invalid payload, try session auth
    }

    // Fetch user from database
    const user = await UserModel.findById(userId).select("-password");
    
    if (!user) {
      return next(); // User not found, try session auth
    }

    // Set user on request object
    req.user = user as Express.User;
    return next();
  } catch (error) {
    // Token is invalid or expired, continue to session auth
    return next();
  }
};

