import { Router, Request, Response } from "express";
import { database } from "../database.js";
import { StockService } from "../services/stock_service.js";
import { requireAuth } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All stock routes require authentication
router.use(requireAuth);

// GET - Get stock for a specific branch by ID
router.get(
  "/:branchId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const lowStock = req.query.low_stock === "true";
    const currentUser = req.user!;

    // Check authorization
    if (currentUser.role === "salesman" && currentUser.branch_id !== branchId) {
      throw new AppError("Not authorized to view this branch", 403);
    }

    const stock = await StockService.getBranchStock(
      database.sequelize!,
      branchId,
      lowStock,
    );

    res.json(stock);
  }),
);

// GET - Get stock for current user's branch
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const lowStock = req.query.low_stock === "true";

    if (!currentUser.branch_id) {
      throw new AppError("User not assigned to a branch", 400);
    }
    const stock = await StockService.getBranchStock(
      database.sequelize!,
      currentUser.branch_id,
      lowStock,
    );

    res.json(stock);
  }),
);

// GET - Get low stock products
router.get(
  "/low-stock",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;

    let branchId = currentUser.branch_id;
    if (currentUser.role === "admin" && req.query.branch_id) {
      branchId = parseInt(req.query.branch_id as string);
    }

    if (!branchId) {
      throw new AppError("Branch ID is required", 400);
    }

    const lowStockProducts = await StockService.getLowStockProducts(
      database.sequelize!,
      branchId,
    );

    res.json({
      low_stock_products: lowStockProducts,
      count: lowStockProducts.length,
    });
  }),
);

// POST - Add stock to a branch
router.post(
  "/:branchId/:productId/add",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const productId = parseInt(req.params.productId as string);
    const quantity = parseFloat(req.query.quantity as string);
    const withVat = req.query.with_vat !== "false";
    const notes = req.query.notes as string;
    const currentUser = req.user!;

    if (!quantity || quantity <= 0) {
      throw new AppError("Quantity must be greater than 0", 400);
    }

    // Check authorization
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }
      if (currentUser.branch_id !== branchId) {
        throw new AppError("Not authorized to add stock to this branch", 403);
      }
    }

    const result = await StockService.addStock(
      database.sequelize!,
      branchId,
      productId,
      quantity,
      currentUser.id,
      withVat,
      notes,
    );

    res.json(result);
  }),
);

// PUT - Adjust stock to a specific quantity
router.put(
  "/:branchId/:productId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const productId = parseInt(req.params.productId as string);
    const quantity = parseFloat(req.query.quantity as string);
    const reason = req.query.reason as string;
    const currentUser = req.user!;

    if (quantity === undefined || quantity < 0) {
      throw new AppError(
        "Quantity must be provided and cannot be negative",
        400,
      );
    }

    // Check authorization
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }
      if (currentUser.branch_id !== branchId) {
        throw new AppError(
          "Not authorized to adjust stock for this branch",
          403,
        );
      }
    }

    const result = await StockService.adjustStock(
      database.sequelize!,
      branchId,
      productId,
      quantity,
      currentUser.id,
      reason,
    );

    res.json(result);
  }),
);

// POST - Initialize stock for all products in a branch
router.post(
  "/initialize/:branchId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const currentUser = req.user!;

    // Check authorization
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }
      if (currentUser.branch_id !== branchId) {
        throw new AppError(
          "Not authorized to initialize stock for this branch",
          403,
        );
      }
    }

    const result = await StockService.initializeBranchStock(
      database.sequelize!,
      branchId,
      currentUser.id,
    );

    res.json(result);
  }),
);

// GET - Stock movement history for a product
router.get(
  "/:branchId/history/:productId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const productId = parseInt(req.params.productId as string);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const currentUser = req.user!;

    // Check authorization
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }
      if (currentUser.branch_id !== branchId) {
        throw new AppError(
          "Not authorized to view history for this branch",
          403,
        );
      }
    }

    const history = await StockService.getStockHistory(
      database.sequelize!,
      branchId,
      productId,
      limit,
    );

    res.json(history);
  }),
);

// GET - Stock summary for dashboard
router.get(
  "/summary/dashboard",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;

    let branchId = currentUser.branch_id;
    if (currentUser.role === "admin" && req.query.branch_id) {
      branchId = parseInt(req.query.branch_id as string);
    }

    if (!branchId) {
      throw new AppError("Branch ID is required", 400);
    }

    const stock = await StockService.getBranchStock(
      database.sequelize!,
      branchId,
    );

    const summary = {
      total_products: stock.length,
      total_quantity: stock.reduce((sum, item) => sum + item.quantity, 0),
      total_with_vat: stock.reduce((sum, item) => sum + item.stock_with_vat, 0),
      total_without_vat: stock.reduce(
        (sum, item) => sum + item.stock_without_vat,
        0,
      ),
      low_stock_count: stock.filter((item) => item.status === "low").length,
      out_of_stock_count: stock.filter((item) => item.status === "out_of_stock")
        .length,
      normal_stock_count: stock.filter((item) => item.status === "normal")
        .length,
    };

    res.json(summary);
  }),
);

export default router;
