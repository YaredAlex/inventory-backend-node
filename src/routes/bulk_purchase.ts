import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { database } from "../database.js";
import {
  BulkPurchaseOrder,
  BulkPurchaseStatus,
} from "../models/bulk_purchase_order.js";
import { BulkPurchaseOrderItem } from "../models/bulk_purchase_order_item.js";
import { BulkProduct } from "../models/bulk_product.js";
import { BulkStock } from "../models/bulk_stock.js";
import { BulkStockMovement } from "../models/bulk_stock_movement.js";
import { BankAccount } from "../models/bank_account.js";
import { User } from "../models/user.js";
import { Branch } from "../models/branch.js";
import { BulkPurchaseService } from "../services/bulk_purchase.js";
import {
  validateBulkPurchaseCreate,
  validateBulkPurchaseReceive,
  generateBulkOrderNumber,
} from "../schemas/bulk_purchase.js";
import { requireAuth, requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All bulk purchase routes require authentication
router.use(requireAuth);

// ==================== BULK PURCHASE ORDER ROUTES ====================

// POST - Create bulk purchase order
router.post(
  "/orders",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;

    if (!currentUser.branch_id) {
      throw new AppError("User not assigned to a branch", 400);
    }

    const purchaseOrder = await BulkPurchaseService.createBulkPurchaseOrder(
      database.sequelize!,
      currentUser.branch_id,
      currentUser.id,
      req.body,
    );

    res.status(201).json(purchaseOrder);
  }),
);

// GET - Get all bulk purchase orders
router.get(
  "/orders",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      supplier,
      status,
      from_date,
      to_date,
      skip = 0,
      limit = 100,
    } = req.query;

    const where: any = {};
    if (supplier) {
      where.supplier = { [Op.like]: `%${supplier}%` };
    }
    if (status) {
      where.status = status;
    }
    if (from_date) {
      where.order_date = { [Op.gte]: new Date(from_date as string) };
    }
    if (to_date) {
      const endDate = new Date(to_date as string);
      endDate.setHours(23, 59, 59, 999);
      where.order_date = { ...where.order_date, [Op.lte]: endDate };
    }

    const orders = await BulkPurchaseOrder.findAll({
      where,
      order: [["order_date", "DESC"]],
      offset: Number(skip),
      limit: Number(limit),
      include: [{ model: BulkPurchaseOrderItem, as: "items" }],
    });

    const result = [];
    for (const order of orders) {
      const creator = await User.findByPk(order.created_by);
      const branch = await Branch.findByPk(order.branch_id);
      let bankAccountName = null;
      let bankName = null;

      if (order.bank_account_id) {
        const bankAccount = await BankAccount.findByPk(order.bank_account_id);
        if (bankAccount) {
          bankAccountName = bankAccount.account_name;
          bankName = bankAccount.bank_name;
        }
      }

      const items = [];
      for (const item of order.items || []) {
        const product = await BulkProduct.findByPk(item.bulk_product_id);
        items.push({
          id: item.id,
          bulk_product_id: item.bulk_product_id,
          product_name: product?.name || null,
          unit_of_measure: product?.unit_of_measure || "m²",
          selected_category: item.selected_category,
          total_area: Number(item.total_area),
          buying_price: Number(item.buying_price),
          total_cost: Number(item.total_cost),
          notes: item.notes,
        });
      }

      result.push({
        id: order.id,
        order_number: order.order_number,
        branch_id: order.branch_id,
        branch_name: branch?.name || null,
        supplier: order.supplier,
        expected_delivery_date: order.expected_delivery_date,
        order_date: order.order_date,
        actual_delivery_date: order.actual_delivery_date,
        status: order.status,
        subtotal: Number(order.subtotal),
        vat_rate: Number(order.vat_rate),
        vat_amount: Number(order.vat_amount),
        tax_amount: Number(order.tax_amount),
        total_amount: Number(order.total_amount),
        notes: order.notes,
        created_by: creator?.name || "System",
        created_at: order.created_at,
        updated_at: order.updated_at,
        items,
        bank_account_id: order.bank_account_id,
        bank_account_name: bankAccountName,
        bank_name: bankName,
        payment_reference: order.payment_reference,
        payment_date: order.payment_date,
      });
    }

    res.json(result);
  }),
);

// GET - Get bulk purchase order by ID
router.get(
  "/orders/:orderId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);

    const order = await BulkPurchaseOrder.findByPk(orderId, {
      include: [{ model: BulkPurchaseOrderItem, as: "items" }],
    });

    if (!order) {
      throw new AppError("Bulk purchase order not found", 404);
    }

    const creator = await User.findByPk(order.created_by);
    const branch = await Branch.findByPk(order.branch_id);
    let bankAccountName = null;
    let bankName = null;

    if (order.bank_account_id) {
      const bankAccount = await BankAccount.findByPk(order.bank_account_id);
      if (bankAccount) {
        bankAccountName = bankAccount.account_name;
        bankName = bankAccount.bank_name;
      }
    }

    const items = [];
    for (const item of order.items || []) {
      const product = await BulkProduct.findByPk(item.bulk_product_id);
      items.push({
        id: item.id,
        bulk_product_id: item.bulk_product_id,
        product_name: product?.name || null,
        unit_of_measure: product?.unit_of_measure || "m²",
        category_options: product?.category_options || [],
        selected_category: item.selected_category,
        total_area: Number(item.total_area),
        buying_price: Number(item.buying_price),
        total_cost: Number(item.total_cost),
        notes: item.notes,
      });
    }

    res.json({
      id: order.id,
      order_number: order.order_number,
      branch_id: order.branch_id,
      branch_name: branch?.name || null,
      supplier: order.supplier,
      expected_delivery_date: order.expected_delivery_date,
      order_date: order.order_date,
      actual_delivery_date: order.actual_delivery_date,
      status: order.status,
      subtotal: Number(order.subtotal),
      vat_rate: Number(order.vat_rate),
      vat_amount: Number(order.vat_amount),
      tax_amount: Number(order.tax_amount),
      total_amount: Number(order.total_amount),
      notes: order.notes,
      created_by: creator?.name || "System",
      created_at: order.created_at,
      updated_at: order.updated_at,
      items,
      bank_account_id: order.bank_account_id,
      bank_account_name: bankAccountName,
      bank_name: bankName,
      payment_reference: order.payment_reference,
      payment_date: order.payment_date,
    });
  }),
);

// GET - Get bulk purchase order by order number
router.get(
  "/orders/number/:orderNumber",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderNumber = req.params.orderNumber;

    const order = await BulkPurchaseOrder.findOne({
      where: { order_number: orderNumber },
      include: [{ model: BulkPurchaseOrderItem, as: "items" }],
    });

    if (!order) {
      throw new AppError("Bulk purchase order not found", 404);
    }

    const creator = await User.findByPk(order.created_by);
    const branch = await Branch.findByPk(order.branch_id);
    let bankAccountName = null;
    let bankName = null;

    if (order.bank_account_id) {
      const bankAccount = await BankAccount.findByPk(order.bank_account_id);
      if (bankAccount) {
        bankAccountName = bankAccount.account_name;
        bankName = bankAccount.bank_name;
      }
    }

    const items = [];
    for (const item of order.items || []) {
      const product = await BulkProduct.findByPk(item.bulk_product_id);
      items.push({
        id: item.id,
        bulk_product_id: item.bulk_product_id,
        product_name: product?.name || null,
        unit_of_measure: product?.unit_of_measure || "m²",
        selected_category: item.selected_category,
        total_area: Number(item.total_area),
        buying_price: Number(item.buying_price),
        total_cost: Number(item.total_cost),
        notes: item.notes,
      });
    }

    res.json({
      id: order.id,
      order_number: order.order_number,
      branch_id: order.branch_id,
      branch_name: branch?.name || null,
      supplier: order.supplier,
      expected_delivery_date: order.expected_delivery_date,
      order_date: order.order_date,
      actual_delivery_date: order.actual_delivery_date,
      status: order.status,
      subtotal: Number(order.subtotal),
      vat_rate: Number(order.vat_rate),
      vat_amount: Number(order.vat_amount),
      tax_amount: Number(order.tax_amount),
      total_amount: Number(order.total_amount),
      notes: order.notes,
      created_by: creator?.name || "System",
      created_at: order.created_at,
      updated_at: order.updated_at,
      items,
      bank_account_id: order.bank_account_id,
      bank_account_name: bankAccountName,
      bank_name: bankName,
      payment_reference: order.payment_reference,
      payment_date: order.payment_date,
    });
  }),
);

// POST - Receive bulk purchase order
router.post(
  "/orders/:orderId/receive",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const currentUser = req.user!;

    if (!currentUser.branch_id) {
      throw new AppError("User not assigned to a branch", 400);
    }

    const result = await BulkPurchaseService.receiveBulkPurchaseOrder(
      database.sequelize!,
      orderId,
      currentUser.branch_id,
      currentUser.id,
      req.body,
    );

    res.json(result);
  }),
);

// PUT - Update bulk purchase order
router.put(
  "/orders/:orderId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const updateData = req.body;

    const purchaseOrder = await BulkPurchaseOrder.findByPk(orderId);
    if (!purchaseOrder) {
      throw new AppError("Bulk purchase order not found", 404);
    }

    if (updateData.status) purchaseOrder.status = updateData.status;
    if (updateData.expected_delivery_date)
      purchaseOrder.expected_delivery_date = updateData.expected_delivery_date;
    if (updateData.actual_delivery_date)
      purchaseOrder.actual_delivery_date = updateData.actual_delivery_date;
    if (updateData.notes) purchaseOrder.notes = updateData.notes;
    if (updateData.bank_account_id !== undefined)
      purchaseOrder.bank_account_id = updateData.bank_account_id;
    if (updateData.payment_reference !== undefined)
      purchaseOrder.payment_reference = updateData.payment_reference;
    if (updateData.payment_date)
      purchaseOrder.payment_date = updateData.payment_date;

    purchaseOrder.updated_at = new Date();
    await purchaseOrder.save();

    const creator = await User.findByPk(purchaseOrder.created_by);
    const branch = await Branch.findByPk(purchaseOrder.branch_id);
    let bankAccountName = null;
    let bankName = null;

    if (purchaseOrder.bank_account_id) {
      const bankAccount = await BankAccount.findByPk(
        purchaseOrder.bank_account_id,
      );
      if (bankAccount) {
        bankAccountName = bankAccount.account_name;
        bankName = bankAccount.bank_name;
      }
    }

    const items = [];
    for (const item of purchaseOrder.items || []) {
      const product = await BulkProduct.findByPk(item.bulk_product_id);
      items.push({
        id: item.id,
        bulk_product_id: item.bulk_product_id,
        product_name: product?.name || null,
        unit_of_measure: product?.unit_of_measure || "m²",
        selected_category: item.selected_category,
        total_area: Number(item.total_area),
        buying_price: Number(item.buying_price),
        total_cost: Number(item.total_cost),
        notes: item.notes,
      });
    }

    res.json({
      id: purchaseOrder.id,
      order_number: purchaseOrder.order_number,
      branch_id: purchaseOrder.branch_id,
      branch_name: branch?.name || null,
      supplier: purchaseOrder.supplier,
      expected_delivery_date: purchaseOrder.expected_delivery_date,
      order_date: purchaseOrder.order_date,
      actual_delivery_date: purchaseOrder.actual_delivery_date,
      status: purchaseOrder.status,
      subtotal: Number(purchaseOrder.subtotal),
      vat_rate: Number(purchaseOrder.vat_rate),
      vat_amount: Number(purchaseOrder.vat_amount),
      tax_amount: Number(purchaseOrder.tax_amount),
      total_amount: Number(purchaseOrder.total_amount),
      notes: purchaseOrder.notes,
      created_by: creator?.name || "System",
      created_at: purchaseOrder.created_at,
      updated_at: purchaseOrder.updated_at,
      items,
      bank_account_id: purchaseOrder.bank_account_id,
      bank_account_name: bankAccountName,
      bank_name: bankName,
      payment_reference: purchaseOrder.payment_reference,
      payment_date: purchaseOrder.payment_date,
    });
  }),
);

// DELETE - Cancel bulk purchase order
router.delete(
  "/orders/:orderId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const { reason } = req.body;

    const purchaseOrder = await BulkPurchaseOrder.findByPk(orderId);
    if (!purchaseOrder) {
      throw new AppError("Bulk purchase order not found", 404);
    }

    if (purchaseOrder.status === BulkPurchaseStatus.COMPLETED) {
      throw new AppError("Cannot cancel a completed purchase order", 400);
    }

    if (purchaseOrder.status === BulkPurchaseStatus.PARTIALLY_RECEIVED) {
      throw new AppError(
        "Cannot cancel a partially received purchase order. Please process returns first.",
        400,
      );
    }

    const cancelled = await BulkPurchaseService.cancelBulkPurchaseOrder(
      database.sequelize!,
      orderId,
      reason,
    );

    if (!cancelled) {
      throw new AppError("Failed to cancel purchase order", 500);
    }

    res.status(204).send();
  }),
);

// ==================== STOCK ROUTES ====================

// GET - Get stock movements for a bulk purchase order
router.get(
  "/orders/:orderId/stock-movements",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);

    const movements = await BulkStockMovement.findAll({
      where: {
        reference_id: orderId,
        reference_type: "BulkPurchaseOrder",
      },
      include: [
        {
          model: BulkStock,
          as: "stock",
          include: [
            {
              model: BulkProduct,
              as: "product",
              attributes: ["name", "unit_of_measure"],
            },
            { model: Branch, as: "branch", attributes: ["name"] },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json(
      movements.map((m) => ({
        id: m.id,
        bulk_stock_id: m.bulk_stock_id,
        product_name: (m as any).stock?.product?.name || "Unknown",
        unit_of_measure: (m as any).stock?.product?.unit_of_measure || "m²",
        category: (m as any).stock?.category,
        branch_name: (m as any).stock?.branch?.name,
        quantity: Number(m.quantity),
        type: m.type,
        notes: m.notes,
        created_at: m.created_at,
      })),
    );
  }),
);

// ==================== REPORTS ROUTE ====================

router.get(
  "/reports",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { from_date, to_date } = req.query;

    let startDate: Date;
    let endDate: Date;

    if (to_date) {
      endDate = new Date(to_date as string);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    if (from_date) {
      startDate = new Date(from_date as string);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    const purchaseOrders = await BulkPurchaseOrder.findAll({
      where: {
        order_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [{ model: BulkPurchaseOrderItem, as: "items" }],
    });

    let totalPurchaseCost = 0;
    let totalVatAmount = 0;
    let totalSubtotal = 0;
    let totalAreaPurchased = 0;

    for (const po of purchaseOrders) {
      totalPurchaseCost += Number(po.total_amount);
      totalVatAmount += Number(po.vat_amount);
      totalSubtotal += Number(po.subtotal);

      for (const item of po.items || []) {
        totalAreaPurchased += Number(item.total_area);
      }
    }

    const bankAccountSummary: Record<string, any> = {};
    for (const po of purchaseOrders) {
      if (po.bank_account_id) {
        const bankAccount = await BankAccount.findByPk(po.bank_account_id);
        if (bankAccount) {
          const key = `${bankAccount.bank_name} - ${bankAccount.account_number}`;
          if (!bankAccountSummary[key]) {
            bankAccountSummary[key] = {
              bank_name: bankAccount.bank_name,
              account_number: bankAccount.account_number,
              account_name: bankAccount.account_name,
              total_amount: 0,
              order_count: 0,
            };
          }
          bankAccountSummary[key].total_amount += Number(po.total_amount);
          bankAccountSummary[key].order_count += 1;
        }
      }
    }

    const supplierTotals: Record<
      string,
      { total_amount: number; total_area: number; order_count: number }
    > = {};
    for (const po of purchaseOrders) {
      if (!supplierTotals[po.supplier]) {
        supplierTotals[po.supplier] = {
          total_amount: 0,
          total_area: 0,
          order_count: 0,
        };
      }
      //   supplierTotals[po.supplier!].total_amount += Number(po.total_amount);
      //   supplierTotals[po.supplier!].order_count += 1;

      //   for (const item of po.items || []) {
      //     supplierTotals[po.supplier!].total_area += Number(item.total_area);
      //   }
    }

    const productTotals: Record<
      string,
      {
        product_name: string;
        total_area: number;
        total_cost: number;
        order_count: number;
      }
    > = {};
    for (const po of purchaseOrders) {
      for (const item of po.items || []) {
        const product = await BulkProduct.findByPk(item.bulk_product_id);
        const productName =
          product?.name || `Product ID ${item.bulk_product_id}`;
        const categoryKey = item.selected_category
          ? `${productName} - ${item.selected_category}`
          : productName;

        if (!productTotals[categoryKey]) {
          productTotals[categoryKey] = {
            product_name: productName,
            total_area: 0,
            total_cost: 0,
            order_count: 0,
          };
        }
        productTotals[categoryKey].total_area += Number(item.total_area);
        productTotals[categoryKey].total_cost += Number(item.total_cost);
        productTotals[categoryKey].order_count += 1;
      }
    }

    const statusBreakdown = {
      pending: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.PENDING,
      ).length,
      approved: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.APPROVED,
      ).length,
      shipped: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.SHIPPED,
      ).length,
      received: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.RECEIVED,
      ).length,
      partially_received: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.PARTIALLY_RECEIVED,
      ).length,
      completed: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.COMPLETED,
      ).length,
      cancelled: purchaseOrders.filter(
        (po) => po.status === BulkPurchaseStatus.CANCELLED,
      ).length,
    };

    res.json({
      date_range: {
        from_date: startDate.toISOString().split("T")[0],
        to_date: endDate.toISOString().split("T")[0],
      },
      summary: {
        total_purchase_orders: purchaseOrders.length,
        total_purchase_cost: totalPurchaseCost,
        total_subtotal: totalSubtotal,
        total_vat_amount: totalVatAmount,
        total_area_purchased: totalAreaPurchased,
        average_order_value:
          purchaseOrders.length > 0
            ? totalPurchaseCost / purchaseOrders.length
            : 0,
        average_vat_rate:
          totalSubtotal > 0 ? (totalVatAmount / totalSubtotal) * 100 : 0,
      },
      status_breakdown: statusBreakdown,
      bank_account_summary: Object.values(bankAccountSummary),
      supplier_breakdown: Object.entries(supplierTotals)
        .map(([supplier, data]) => ({
          supplier,
          total_amount: data.total_amount,
          total_area: data.total_area,
          order_count: data.order_count,
          average_order_value:
            data.order_count > 0 ? data.total_amount / data.order_count : 0,
        }))
        .sort((a, b) => b.total_amount - a.total_amount),
      product_breakdown: Object.values(productTotals).sort(
        (a, b) => b.total_cost - a.total_cost,
      ),
      recent_orders: purchaseOrders.slice(0, 20).map((po) => ({
        order_number: po.order_number,
        supplier: po.supplier,
        order_date: po.order_date,
        total_amount: Number(po.total_amount),
        vat_amount: Number(po.vat_amount),
        vat_rate: Number(po.vat_rate),
        status: po.status,
        items_count: po.items?.length || 0,
        total_area:
          po.items?.reduce((sum, item) => sum + Number(item.total_area), 0) ||
          0,
      })),
    });
  }),
);

// ==================== STATISTICS ROUTE ====================

router.get(
  "/statistics",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { branch_id } = req.query;
    const branchId = branch_id ? parseInt(branch_id as string) : undefined;

    const statistics = await BulkPurchaseService.getBulkPurchaseStatistics(
      database.sequelize!,
      branchId,
    );

    const recentOrders = await BulkPurchaseService.getRecentBulkPurchaseOrders(
      database.sequelize!,
      10,
      branchId,
    );

    res.json({
      ...statistics,
      recent_orders: recentOrders,
    });
  }),
);

// ==================== ITEM ROUTES ====================

// GET - Get items for a bulk purchase order
router.get(
  "/orders/:orderId/items",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);

    const items = await BulkPurchaseOrderItem.findAll({
      where: { bulk_purchase_order_id: orderId },
      include: [
        {
          model: BulkProduct,
          as: "product",
          attributes: ["name", "unit_of_measure", "category_options"],
        },
      ],
    });

    if (!items.length) {
      throw new AppError("No items found for this purchase order", 404);
    }

    res.json(
      items.map((item) => ({
        id: item.id,
        bulk_product_id: item.bulk_product_id,
        product_name: (item as any).product?.name || "Unknown",
        unit_of_measure: (item as any).product?.unit_of_measure || "m²",
        selected_category: item.selected_category,
        total_area: Number(item.total_area),
        buying_price: Number(item.buying_price),
        total_cost: Number(item.total_cost),
        notes: item.notes,
      })),
    );
  }),
);

// GET - Export orders to CSV (optional)
router.get(
  "/export",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { from_date, to_date, format = "json" } = req.query;

    let startDate: Date;
    let endDate: Date;

    if (to_date) {
      endDate = new Date(to_date as string);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    if (from_date) {
      startDate = new Date(from_date as string);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    const orders = await BulkPurchaseOrder.findAll({
      where: {
        order_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        { model: BulkPurchaseOrderItem, as: "items" },
        { model: Branch, as: "branch" },
      ],
      order: [["order_date", "DESC"]],
    });

    const exportData = [];
    for (const order of orders) {
      for (const item of order.items || []) {
        const product = await BulkProduct.findByPk(item.bulk_product_id);
        exportData.push({
          order_number: order.order_number,
          order_date: order.order_date,
          supplier: order.supplier,
          branch_name: (order as any).branch?.name,
          status: order.status,
          product_name: product?.name || "Unknown",
          category: item.selected_category || "Uncategorized",
          unit_of_measure: product?.unit_of_measure || "m²",
          total_area: Number(item.total_area),
          buying_price: Number(item.buying_price),
          total_cost: Number(item.total_cost),
          vat_rate: Number(order.vat_rate),
          vat_amount: Number(order.vat_amount),
          grand_total: Number(order.total_amount),
        });
      }
    }

    if (format === "csv") {
      // CSV export would be implemented here
      res.json({ message: "CSV export not yet implemented", data: exportData });
    } else {
      res.json(exportData);
    }
  }),
);

export default router;
