import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { database } from "../database.js";
import { Branch } from "../models/branch.js";
import { User } from "../models/user.js";
import { Stock } from "../models/stock.js";
import { Sale } from "../models/sale.js";
import { BranchService } from "../services/branch_service.js";
import {
  validateBranchCreate,
  validateBranchUpdate,
  BranchResponse,
} from "../schemas/branch.js";
import { requireAdmin, requireAuth } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();
router.use(requireAuth);
// ==================== WRITE OPERATIONS (Admin only) ====================

// POST - Create branch (handle both with and without trailing slash)
router.post(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchData = validateBranchCreate(req.body);

    const branch = await BranchService.createBranch(
      database.sequelize!,
      branchData,
    );

    const response: BranchResponse = {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      created_at: branch.created_at,
    };

    res.status(201).json(response);
  }),
);

// ==================== READ OPERATIONS ====================

// GET - Get all branches (handle both with and without trailing slash)
router.get(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branches = await BranchService.getBranches(database.sequelize!);
    const response: BranchResponse[] = branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      created_at: branch.created_at,
    }));

    res.json(response);
  }),
);

// GET by ID - Get branch details
router.get(
  "/:branchId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);

    const branch = await BranchService.getBranch(database.sequelize!, branchId);

    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const response: BranchResponse = {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      created_at: branch.created_at,
    };

    res.json(response);
  }),
);

// ==================== UPDATE OPERATIONS ====================

// PUT - Update branch
router.put(
  "/:branchId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const branchData = validateBranchUpdate(req.body);

    const updatedBranch = await BranchService.updateBranch(
      database.sequelize!,
      branchId,
      branchData,
    );

    if (!updatedBranch) {
      throw new AppError("Branch not found", 404);
    }

    const response: BranchResponse = {
      id: updatedBranch.id,
      name: updatedBranch.name,
      address: updatedBranch.address,
      phone: updatedBranch.phone,
      created_at: updatedBranch.created_at,
    };

    res.json(response);
  }),
);

// ==================== DELETE OPERATIONS ====================

// DELETE - Delete branch
router.delete(
  "/:branchId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);

    // Check if branch exists
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Check if branch has users
    const users = await User.findOne({
      where: { branch_id: branchId },
    });

    if (users) {
      throw new AppError("Cannot delete branch with assigned users", 400);
    }

    // Delete the branch
    await branch.destroy();
    logger.info(`Branch deleted: ID ${branchId}`);

    res.status(200).json({ message: "Branch deleted successfully" });
  }),
);

// ==================== STATISTICS ENDPOINTS ====================

// GET - Get overall branch statistics
router.get(
  "/stats",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get total branches
      const totalBranches = await Branch.count();

      // Get total staff (users assigned to branches)
      const totalStaff = await User.count({
        where: {
          branch_id: { [Op.not]: null },
        },
      });

      // Get total stock across all branches
      const totalStockResult = await Stock.sum("quantity");
      const totalStock = Number(totalStockResult) || 0;

      // Get total revenue from sales (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const totalRevenueResult = await Sale.sum("total_amount", {
        where: {
          created_at: {
            [Op.gte]: thirtyDaysAgo,
          },
        },
      });
      const totalRevenue = Number(totalRevenueResult) || 0;

      res.json({
        total_branches: totalBranches,
        total_staff: totalStaff,
        total_stock: totalStock,
        total_revenue: totalRevenue,
      });
    } catch (error: any) {
      logger.error(`Error in get_branch_stats: ${error.message}`);

      // Return default values on error
      const totalBranches = await Branch.count();

      res.json({
        total_branches: totalBranches,
        total_staff: 0,
        total_stock: 0,
        total_revenue: 0,
      });
    }
  }),
);

// GET - Get branch specific statistics
router.get(
  "/:branchId/stats",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);

    // Check if branch exists
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Get branch specific stats
    const staffCount = await User.count({
      where: { branch_id: branchId },
    });

    const stockCount = await Stock.count({
      where: { branch_id: branchId },
    });

    const totalStock = await Stock.sum("quantity", {
      where: { branch_id: branchId },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesCount = await Sale.count({
      where: {
        branch_id: branchId,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const totalRevenue = await Sale.sum("total_amount", {
      where: {
        branch_id: branchId,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
    });

    res.json({
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
      },
      statistics: {
        total_staff: staffCount,
        total_stock_items: stockCount,
        total_stock_quantity: Number(totalStock) || 0,
        sales_last_30_days: salesCount,
        revenue_last_30_days: Number(totalRevenue) || 0,
      },
    });
  }),
);

// GET - Get branch summary for dashboard
router.get(
  "/summary",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branches = await Branch.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    const branchSummary = [];

    for (const branch of branches) {
      const staffCount = await User.count({
        where: { branch_id: branch.id },
      });

      const totalStock = await Stock.sum("quantity", {
        where: { branch_id: branch.id },
      });

      branchSummary.push({
        id: branch.id,
        name: branch.name,
        staff_count: staffCount,
        stock_quantity: Number(totalStock) || 0,
      });
    }

    res.json({
      total_branches: branches.length,
      branches: branchSummary,
    });
  }),
);

export default router;
