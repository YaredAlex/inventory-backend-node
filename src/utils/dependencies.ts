import { Request, Response, NextFunction } from "express";
import { Sequelize } from "sequelize";
import { User, UserRole } from "../models/user.js";
import jwt from "jsonwebtoken";
import { settings } from "../config.js";
import logger from "../services/logger.js";

/**
 * Extract token from Authorization header
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1] ?? null;
}

/**
 * Get current user from JWT token
 */
export async function getCurrentUser(
  req: Request,
  sequelize: Sequelize,
): Promise<User> {
  const token = extractToken(req);

  if (!token) {
    throw new Error("No token provided");
  }

  try {
    const payload = jwt.verify(token, settings.SECRET_KEY) as any;

    logger.debug(`🔍 PAYLOAD:`, payload);

    const userId = payload.user_id || payload.userId;
    if (!userId) {
      throw new Error("Invalid token - no user ID");
    }

    const user = await User.findByPk(userId);

    logger.debug(`👤 USER:`, user);

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.active) {
      throw new Error("User is inactive");
    }

    return user;
  } catch (error: any) {
    logger.error(`❌ AUTH ERROR:`, error.message);
    throw new Error("Could not validate credentials");
  }
}

/**
 * Express middleware to require authentication
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getCurrentUser(req, req.app.get("sequelize"));
    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ detail: error.message });
  }
}

/**
 * Express middleware to require admin role
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getCurrentUser(req, req.app.get("sequelize"));

    if (user.role !== UserRole.ADMIN) {
      res.status(403).json({ detail: "Admin privileges required" });
      return;
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ detail: error.message });
  }
}

export async function requireSalesman(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getCurrentUser(req, req.app.get("sequelize"));

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SALESMAN &&
      user.role !== UserRole.PRIVILEGED_SALES
    ) {
      res.status(403).json({ detail: "Sales access required" });
      return;
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ detail: error.message });
  }
}
/**
 * Express middleware to require privileged access (admin or privileged_sales)
 */
export async function requirePrivileged(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getCurrentUser(req, req.app.get("sequelize"));

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PRIVILEGED_SALES
    ) {
      res.status(403).json({ detail: "Privileged access required" });
      return;
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ detail: error.message });
  }
}

/**
 * Optional auth - doesn't fail if no token, just sets user to null
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (token) {
      const user = await getCurrentUser(req, req.app.get("sequelize"));
      (req as any).user = user;
    } else {
      (req as any).user = null;
    }
    next();
  } catch (error) {
    (req as any).user = null;
    next();
  }
}
