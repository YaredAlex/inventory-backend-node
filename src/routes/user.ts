import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { database } from "../database.js";
import { User, UserRole } from "../models/user.js";
import { AuthService } from "../services/auth_service.js";
import {
  validateUserCreate,
  validateUserUpdate,
  validateUserProfileUpdate,
  validateChangePassword,
  UserResponse,
} from "../schemas/user.js";
import {
  requireAdmin,
  getCurrentUser,
  requireAuth,
} from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();
// All product routes require authentication
router.use(requireAuth);
// ==================== ADMIN USER MANAGEMENT ====================

// POST - Create user (handle both with and without slash)
router.post(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userData = validateUserCreate(req.body);

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new AppError("Email already registered", 400);
    }

    // Hash password
    const passwordHash = await AuthService.getPasswordHash(userData.password);

    // Create user
    const newUser = await User.create({
      name: userData.name,
      email: userData.email,
      password_hash: passwordHash,
      role: userData.role as UserRole,
      branch_id: userData.branch_id,
      active: userData.active,
    });

    logger.info(`User created: ${newUser.email} (ID: ${newUser.id}) by admin`);

    const response: UserResponse = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      branch_id: newUser.branch_id,
      active: newUser.active,
      created_at: newUser.created_at,
    };

    res.status(201).json(response);
  }),
);

// GET - Get all users (handle both with and without slash)
router.get(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const users = await User.findAll({
      order: [["created_at", "DESC"]],
    });

    const response: UserResponse[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      active: user.active,
      created_at: user.created_at,
    }));

    res.json(response);
  }),
);

// GET by ID - Get user details
router.get(
  "/:userId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId as string);

    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const response: UserResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      active: user.active,
      created_at: user.created_at,
    };

    res.json(response);
  }),
);

// PUT by ID - Update user
router.put(
  "/:userId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId as string);
    const userData = validateUserUpdate(req.body);

    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If email is being updated, check for duplicates
    if (userData.email && userData.email !== user.email) {
      const existingUser = await User.findOne({
        where: {
          email: userData.email,
          id: { [Op.ne]: userId },
        },
      });

      if (existingUser) {
        throw new AppError("Email already registered", 400);
      }
    }

    // Prepare update data
    const updateFields: any = {};
    if (userData.name !== undefined) updateFields.name = userData.name;
    if (userData.email !== undefined) updateFields.email = userData.email;
    if (userData.role !== undefined) updateFields.role = userData.role;
    if (userData.branch_id !== undefined)
      updateFields.branch_id = userData.branch_id;
    if (userData.active !== undefined) updateFields.active = userData.active;

    // Hash password if provided
    if (userData.password) {
      updateFields.password_hash = await AuthService.getPasswordHash(
        userData.password,
      );
    }

    await User.update(updateFields, {
      where: { id: userId },
    });

    const updatedUser = await User.findByPk(userId);
    logger.info(`User updated: ID ${userId} by admin`);

    const response: UserResponse = {
      id: updatedUser!.id,
      name: updatedUser!.name,
      email: updatedUser!.email,
      role: updatedUser!.role,
      branch_id: updatedUser!.branch_id,
      active: updatedUser!.active,
      created_at: updatedUser!.created_at,
    };

    res.json(response);
  }),
);

// DELETE by ID - Delete user
router.delete(
  "/:userId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId as string);
    const currentUser = req.user;

    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Cannot delete your own account
    if (user.id === currentUser.id) {
      throw new AppError("Cannot delete your own account", 400);
    }

    await user.destroy();
    logger.info(`User deleted: ID ${userId} by admin ${currentUser.id}`);

    res.status(204).send();
  }),
);

// ==================== CURRENT USER ENDPOINTS ====================

// GET /me - Get current user profile
router.get(
  "/me",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = await getCurrentUser(req, database.sequelize!);

    const response: UserResponse = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      branch_id: currentUser.branch_id,
      active: currentUser.active,
      created_at: currentUser.created_at,
    };

    res.json(response);
  }),
);

// PUT /me - Update current user profile
router.put(
  "/me",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = await getCurrentUser(req, database.sequelize!);
    const userData = validateUserProfileUpdate(req.body);

    // If email is being updated, check for duplicates
    if (userData.email && userData.email !== currentUser.email) {
      const existingUser = await User.findOne({
        where: {
          email: userData.email,
          id: { [Op.ne]: currentUser.id },
        },
      });

      if (existingUser) {
        throw new AppError("Email already registered", 400);
      }
    }

    // Update fields
    const updateFields: any = {};
    if (userData.name !== undefined) updateFields.name = userData.name;
    if (userData.email !== undefined) updateFields.email = userData.email;

    // Hash password if provided
    if (userData.password) {
      updateFields.password_hash = await AuthService.getPasswordHash(
        userData.password,
      );
    }

    await User.update(updateFields, {
      where: { id: currentUser.id },
    });

    const updatedUser = await User.findByPk(currentUser.id);
    logger.info(`User profile updated: ID ${currentUser.id}`);

    const response: UserResponse = {
      id: updatedUser!.id,
      name: updatedUser!.name,
      email: updatedUser!.email,
      role: updatedUser!.role,
      branch_id: updatedUser!.branch_id,
      active: updatedUser!.active,
      created_at: updatedUser!.created_at,
    };

    res.json(response);
  }),
);

// POST /me/change-password - Change current user password
router.post(
  "/me/change-password",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = await getCurrentUser(req, database.sequelize!);
    const passwordData = validateChangePassword(req.body);

    // Verify current password
    const isValid = await AuthService.verifyPassword(
      passwordData.current_password,
      currentUser.password_hash,
    );

    if (!isValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    // Hash and update new password
    const newPasswordHash = await AuthService.getPasswordHash(
      passwordData.new_password,
    );

    await User.update(
      { password_hash: newPasswordHash },
      { where: { id: currentUser.id } },
    );

    logger.info(`Password changed for user: ID ${currentUser.id}`);

    res.json({ message: "Password changed successfully" });
  }),
);

// ==================== ADDITIONAL USER ENDPOINTS ====================

// GET /users/by-branch/:branchId - Get users by branch
router.get(
  "/by-branch/:branchId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);

    const users = await User.findAll({
      where: { branch_id: branchId },
      order: [["name", "ASC"]],
    });

    const response: UserResponse[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      active: user.active,
      created_at: user.created_at,
    }));

    res.json(response);
  }),
);

// GET /users/role/:role - Get users by role
router.get(
  "/role/:role",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = req.params.role as string;

    if (!["admin", "salesman", "privileged_sales"].includes(role)) {
      throw new AppError("Invalid role", 400);
    }

    const users = await User.findAll({
      where: { role },
      order: [["name", "ASC"]],
    });

    const response: UserResponse[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      active: user.active,
      created_at: user.created_at,
    }));

    res.json(response);
  }),
);

// PATCH /users/:userId/activate - Activate user
router.patch(
  "/:userId/activate",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId as string);

    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    user.active = true;
    await user.save();

    logger.info(`User activated: ID ${userId}`);

    res.json({ message: "User activated successfully" });
  }),
);

// PATCH /users/:userId/deactivate - Deactivate user
router.patch(
  "/:userId/deactivate",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId as string);
    const currentUser = req.user;

    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.id === currentUser.id) {
      throw new AppError("Cannot deactivate your own account", 400);
    }

    user.active = false;
    await user.save();

    logger.info(`User deactivated: ID ${userId}`);

    res.json({ message: "User deactivated successfully" });
  }),
);

// GET /users/stats/summary - Get user statistics
router.get(
  "/stats/summary",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { active: true } });
    const inactiveUsers = totalUsers - activeUsers;

    const adminCount = await User.count({ where: { role: "admin" } });
    const salesmanCount = await User.count({ where: { role: "salesman" } });
    const privilegedSalesCount = await User.count({
      where: { role: "privileged_sales" },
    });

    const usersWithBranch = await User.count({
      where: { branch_id: { [Op.not]: null } },
    });
    const usersWithoutBranch = totalUsers - usersWithBranch;

    res.json({
      total_users: totalUsers,
      active_users: activeUsers,
      inactive_users: inactiveUsers,
      by_role: {
        admin: adminCount,
        salesman: salesmanCount,
        privileged_sales: privilegedSalesCount,
      },
      by_branch_assignment: {
        assigned: usersWithBranch,
        unassigned: usersWithoutBranch,
      },
    });
  }),
);

export default router;
