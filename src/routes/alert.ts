import { Router, Request, Response } from "express";
import { database } from "../database.js";
import { AlertService } from "../services/alert_service.js";
import { requireAuth, getCurrentUser } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All alert routes require authentication
router.use(requireAuth);

// ==================== GET ALERTS ====================
// Handle BOTH with and without trailing slash
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const resolved = req.query.resolved === "true";
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;

    // Apply branch filtering for sales role
    if (currentUser.role === "salesman") {
      // Sales can only see their own branch
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      // If sales tries to specify a different branch, restrict to their own
      if (branchId && branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view alerts for other branches",
          403,
        );
      }

      // Force filter to user's branch
      branchId = currentUser.branch_id;
    }

    const alerts = await AlertService.getAlerts(
      database.sequelize!,
      resolved,
      branchId,
    );

    res.json(alerts);
  }),
);

// ==================== RESOLVE ALERT ====================
router.post(
  "/:alertId/resolve",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const alertId = parseInt(req.params.alertId as string);
    const currentUser = req.user!;

    // First get the alert to check permissions
    const alert = await AlertService.getAlertById(database.sequelize!, alertId);
    if (!alert) {
      throw new AppError("Alert not found", 404);
    }

    // Check permissions
    if (currentUser.role === "salesman") {
      // Sales can only resolve alerts for their own branch
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (alert.branch_id !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to resolve alerts for other branches",
          403,
        );
      }
    }

    // Resolve the alert
    const resolvedAlert = await AlertService.resolveAlert(
      database.sequelize!,
      alertId,
    );
    if (!resolvedAlert) {
      throw new AppError("Alert not found", 404);
    }

    res.json({ message: "Alert resolved successfully" });
  }),
);

// ==================== MANUALLY TRIGGER LOW STOCK CHECK ====================
router.post(
  "/check-low-stock",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;

    let alertsCreated = 0;
    let resolvedCount = 0;

    try {
      // For sales role, only check their branch
      if (currentUser.role === "salesman") {
        if (!currentUser.branch_id) {
          throw new AppError("User not assigned to a branch", 400);
        }

        // Check low stock only for salesperson's branch
        alertsCreated = await AlertService.checkLowStockForBranch(
          database.sequelize!,
          currentUser.branch_id,
        );
        resolvedCount = await AlertService.autoResolveAlertsForBranch(
          database.sequelize!,
          currentUser.branch_id,
        );
      } else {
        // Admin can check all branches
        alertsCreated = await AlertService.checkLowStockAndCreateAlerts(
          database.sequelize!,
        );
        resolvedCount = await AlertService.autoResolveAlerts(
          database.sequelize!,
        );
      }

      res.json({
        message: "Low stock check completed",
        alerts_created: alertsCreated,
        alerts_resolved: resolvedCount,
      });
    } catch (error: any) {
      logger.error(`Low stock check error: ${error.message}`);
      throw new AppError(error.message, 500);
    }
  }),
);

// ==================== GET LOW STOCK SUMMARY ====================
router.get(
  "/low-stock-summary",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;

    // Apply branch filtering for sales role
    if (currentUser.role === "salesman") {
      // Sales can only see their own branch
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      // If sales tries to specify a different branch, restrict to their own
      if (branchId && branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view summary for other branches",
          403,
        );
      }

      // Force filter to user's branch
      branchId = currentUser.branch_id;
    }

    const summary = await AlertService.getLowStockSummary(
      database.sequelize!,
      branchId,
    );

    res.json(summary);
  }),
);

// ==================== GET ALERT BY ID ====================
router.get(
  "/:alertId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const alertId = parseInt(req.params.alertId as string);
    const currentUser = req.user!;

    const alert = await AlertService.getAlertById(database.sequelize!, alertId);
    if (!alert) {
      throw new AppError("Alert not found", 404);
    }

    // Check permissions for sales role
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (alert.branch_id !== currentUser.branch_id) {
        throw new AppError("Not authorized to view this alert", 403);
      }
    }

    // Get additional details
    const product = await AlertService.getProductForAlert(
      database.sequelize!,
      alert.product_id,
    );
    const branch = await AlertService.getBranchForAlert(
      database.sequelize!,
      alert.branch_id,
    );

    res.json({
      id: alert.id,
      branch_id: alert.branch_id,
      branch_name: branch?.name || "Unknown Branch",
      product_id: alert.product_id,
      product_name: product?.name || "Unknown Product",
      product_sku: product?.sku || "N/A",
      message: alert.message,
      created_at: alert.created_at,
      resolved: alert.resolved,
      resolved_at: alert.resolved_at,
    });
  }),
);

// ==================== BULK RESOLVE ALERTS FOR BRANCH ====================
router.post(
  "/branch/:branchId/bulk-resolve",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const currentUser = req.user!;

    // Check permissions
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to resolve alerts for other branches",
          403,
        );
      }
    }

    const resolvedCount = await AlertService.bulkResolveBranchAlerts(
      database.sequelize!,
      branchId,
    );

    res.json({
      message: `Resolved ${resolvedCount} alerts for branch ${branchId}`,
      alerts_resolved: resolvedCount,
      success: true,
    });
  }),
);

// ==================== GET ALERTS BY BRANCH ====================
router.get(
  "/branch/:branchId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const currentUser = req.user!;
    const resolved = req.query.resolved === "true";

    // Check permissions
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view alerts for other branches",
          403,
        );
      }
    }

    const alerts = await AlertService.getAlertsByBranch(
      database.sequelize!,
      branchId,
      resolved,
    );

    res.json(alerts);
  }),
);

// ==================== GET CRITICAL ALERTS (OUT OF STOCK) ====================
router.get(
  "/type/critical",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;

    // Apply branch filtering for sales role
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (branchId && branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view alerts for other branches",
          403,
        );
      }

      branchId = currentUser.branch_id;
    }

    const alerts = await AlertService.getCriticalAlerts(
      database.sequelize!,
      branchId,
    );

    res.json(alerts);
  }),
);

// ==================== GET WARNING ALERTS (LOW STOCK) ====================
router.get(
  "/type/warning",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;

    // Apply branch filtering for sales role
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (branchId && branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view alerts for other branches",
          403,
        );
      }

      branchId = currentUser.branch_id;
    }

    const alerts = await AlertService.getWarningAlerts(
      database.sequelize!,
      branchId,
    );

    res.json(alerts);
  }),
);

// ==================== ALERT COUNTS ====================
router.get(
  "/counts/summary",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;

    // Apply branch filtering for sales role
    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }

      if (branchId && branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view counts for other branches",
          403,
        );
      }

      branchId = currentUser.branch_id;
    }

    const counts = await AlertService.getAlertCount(
      database.sequelize!,
      branchId,
    );

    res.json(counts);
  }),
);

export default router;
