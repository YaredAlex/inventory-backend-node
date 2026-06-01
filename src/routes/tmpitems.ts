import { Router, Request, Response } from "express";
import { database } from "../database.js";
import { TempItemService } from "../services/tmpitem_service.js";
import { validateTempItemCreate, TempItemStatus } from "../schemas/tmp_item.js";
import { requireAuth, requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";
import { Identifier } from "sequelize";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All temp item routes require authentication
router.use(requireAuth);

// ==================== REGISTER TEMP ITEM ====================
// POST - Register temp item (handle both with and without trailing slash)
router.post(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const itemData = validateTempItemCreate(req.body);

    const tempItem = await TempItemService.registerTempItem(
      database.sequelize!,
      itemData,
      currentUser.id,
    );

    res.status(201).json(tempItem);
  }),
);

// ==================== GET TEMP ITEMS ====================
// GET - Get temp items (handle both with and without trailing slash)
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const items = await TempItemService.getTempItems(
      database.sequelize!,
      currentUser.id,
      currentUser.role,
      { status, search, skip, limit },
    );

    res.json(items);
  }),
);

// ==================== GET SINGLE TEMP ITEM ====================
router.get(
  "/:itemId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId as string);
    const currentUser = req.user!;

    const item = await TempItemService.getTempItemById(
      database.sequelize!,
      itemId,
    );

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    // Check authorization for salesman
    if (
      currentUser.role === "salesman" &&
      item.registered_by !== currentUser.id
    ) {
      throw new AppError("Not authorized to view this item", 403);
    }

    const registrar = await import("../models/user.js").then((m) =>
      m.User.findByPk(item.registered_by),
    );
    const receiver = item.received_by
      ? await import("../models/user.js").then((m) =>
          m.User.findByPk(item.received_by as Identifier),
        )
      : null;

    res.json({
      id: item.id,
      item_number: item.item_number,
      item_name: item.item_name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price ? Number(item.unit_price) : null,
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      notes: item.notes,
      status: item.status,
      registered_by: registrar?.name || "System",
      registered_at: item.registered_at,
      received_by: receiver?.name || null,
      received_at: item.received_at,
    });
  }),
);

// ==================== RECEIVE TEMP ITEM ====================
// PUT - Receive temp item (Admin only)
router.put(
  "/:itemId/receive",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId as string);
    const currentUser = req.user!;

    const result = await TempItemService.receiveTempItem(
      database.sequelize!,
      itemId,
      currentUser.id,
    );

    res.json(result);
  }),
);

// ==================== CANCEL TEMP ITEM ====================
// PUT - Cancel temp item (Salesman can cancel their own, Admin can cancel any)
router.put(
  "/:itemId/cancel",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId as string);
    const currentUser = req.user!;

    const result = await TempItemService.cancelTempItem(
      database.sequelize!,
      itemId,
      currentUser.id,
      currentUser.role,
    );

    res.json(result);
  }),
);

// ==================== GET TEMP ITEMS COUNT ====================
router.get(
  "/count/by-status",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const status = req.query.status as string;

    const count = await TempItemService.getTempItemsCount(
      database.sequelize!,
      currentUser.id,
      currentUser.role,
      status,
    );

    res.json({ count });
  }),
);

// ==================== GET PENDING ITEMS FOR ADMIN ====================
router.get(
  "/pending/admin",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const search = req.query.search as string;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const items = await TempItemService.getTempItems(
      database.sequelize!,
      0, // userId not used for admin
      "admin",
      { status: TempItemStatus.PENDING, search, skip, limit },
    );

    res.json(items);
  }),
);

// ==================== GET MY PENDING ITEMS (SALESMAN) ====================
router.get(
  "/my-pending",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "salesman") {
      throw new AppError("This endpoint is only for salesmen", 403);
    }

    const items = await TempItemService.getTempItems(
      database.sequelize!,
      currentUser.id,
      "salesman",
      { status: TempItemStatus.PENDING },
    );

    res.json(items);
  }),
);

// ==================== BULK RECEIVE TEMP ITEMS (ADMIN) ====================
router.post(
  "/bulk-receive",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { itemIds } = req.body;
    const currentUser = req.user!;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      throw new AppError("Item IDs array is required", 400);
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const itemId of itemIds) {
      try {
        const result = await TempItemService.receiveTempItem(
          database.sequelize!,
          itemId,
          currentUser.id,
        );
        results.push({ itemId, success: true, message: result.message });
        successCount++;
      } catch (error: any) {
        results.push({ itemId, success: false, message: error.message });
        failCount++;
      }
    }

    res.json({
      message: `Processed ${itemIds.length} items: ${successCount} successful, ${failCount} failed`,
      success_count: successCount,
      fail_count: failCount,
      results,
    });
  }),
);

// ==================== CLEANUP OLD TEMP ITEMS (ADMIN) ====================
router.delete(
  "/cleanup",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysOld = req.query.days_old
      ? parseInt(req.query.days_old as string)
      : 30;

    const deletedCount = await TempItemService.cleanupOldTempItems(
      database.sequelize!,
      daysOld,
    );

    res.json({
      message: `Cleaned up ${deletedCount} old cancelled temp items`,
      deleted_count: deletedCount,
      success: true,
    });
  }),
);

export default router;
