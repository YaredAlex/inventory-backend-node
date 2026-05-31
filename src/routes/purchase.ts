import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { database } from "../database.js";
import { Purchase } from "../models/purchase.js";
import { PurchaseOrder } from "../models/purchase_order.js";
import { PurchaseOrderItem } from "../models/purchase_order_item.js";
import { PurchaseItem } from "../models/purchase_item.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { BankAccount } from "../models/bank_account.js";
import { User } from "../models/user.js";
import { PurchaseService } from "../services/purchase_service.js";
import {
  validatePurchaseCreate,
  generateOrderNumber,
} from "../schemas/purchase.js";
import { requireAuth, requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All purchase routes require authentication
router.use(requireAuth);

// ==================== LEGACY PURCHASE ROUTES ====================

// POST - Create purchase
router.post(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const purchaseData = validatePurchaseCreate(req.body);

    const branchId = currentUser.branch_id;
    if (!branchId) {
      throw new AppError("User not assigned to a branch", 400);
    }

    const purchase = await PurchaseService.createPurchase(
      database.sequelize!,
      branchId,
      currentUser.id,
      purchaseData,
    );

    res.status(201).json(purchase);
  }),
);

// GET - Get all purchases
router.get(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { supplier, from_date, to_date, skip = 0, limit = 100 } = req.query;

    const where: any = {};
    if (supplier) {
      where.supplier_name = { [Op.like]: `%${supplier}%` };
    }
    if (from_date) {
      where.created_at = { [Op.gte]: new Date(from_date as string) };
    }
    if (to_date) {
      const endDate = new Date(to_date as string);
      endDate.setHours(23, 59, 59, 999);
      where.created_at = { ...where.created_at, [Op.lte]: endDate };
    }

    const purchases = await Purchase.findAll({
      where,
      order: [["created_at", "DESC"]],
      offset: Number(skip),
      limit: Number(limit),
      include: [{ model: PurchaseItem, as: "items" }],
    });

    res.json(purchases);
  }),
);

// ==================== PURCHASE ORDER ROUTES ====================

// POST - Create purchase order
router.post(
  "/orders",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;

    if (!currentUser.branch_id) {
      throw new AppError("User not assigned to a branch", 400);
    }

    const purchaseOrder = await PurchaseService.createPurchaseOrder(
      database.sequelize!,
      currentUser.branch_id,
      currentUser.id,
      req.body,
    );

    res.status(201).json(purchaseOrder);
  }),
);

// GET - Get all purchase orders
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

    const orders = await PurchaseOrder.findAll({
      where,
      order: [["order_date", "DESC"]],
      offset: Number(skip),
      limit: Number(limit),
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    const result = [];
    for (const order of orders) {
      const creator = await User.findByPk(order.created_by);
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
        const product = await Product.findByPk(item.product_id);
        items.push({
          id: item.id,
          product_id: item.product_id,
          product_name: product?.name || null,
          quantity_ordered: Number(item.quantity_ordered),
          unit_cost: Number(item.unit_cost),
          notes: item.notes,
          quantity_received: Number(item.quantity_received),
          total_cost: Number(item.total_cost),
          received_at: item.received_at,
        });
      }

      result.push({
        id: order.id,
        order_number: order.order_number,
        branch_id: order.branch_id,
        supplier: order.supplier,
        expected_delivery_date: order.expected_delivery_date,
        order_date: order.order_date,
        actual_delivery_date: order.actual_delivery_date,
        status: order.status,
        subtotal: Number(order.subtotal),
        vat_rate: Number(order.vat_rate),
        vat_amount: Number(order.vat_amount),
        tax_amount: Number(order.tax_amount),
        shipping_cost: Number(order.shipping_cost),
        discount_amount: Number(order.discount_amount),
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

// GET - Get purchase order by ID
router.get(
  "/orders/:orderId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);

    const order = await PurchaseOrder.findByPk(orderId, {
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!order) {
      throw new AppError("Purchase order not found", 404);
    }

    const creator = await User.findByPk(order.created_by);
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
      const product = await Product.findByPk(item.product_id);
      items.push({
        id: item.id,
        product_id: item.product_id,
        product_name: product?.name || null,
        quantity_ordered: Number(item.quantity_ordered),
        unit_cost: Number(item.unit_cost),
        notes: item.notes,
        quantity_received: Number(item.quantity_received),
        total_cost: Number(item.total_cost),
        received_at: item.received_at,
      });
    }

    res.json({
      id: order.id,
      order_number: order.order_number,
      branch_id: order.branch_id,
      supplier: order.supplier,
      expected_delivery_date: order.expected_delivery_date,
      order_date: order.order_date,
      actual_delivery_date: order.actual_delivery_date,
      status: order.status,
      subtotal: Number(order.subtotal),
      vat_rate: Number(order.vat_rate),
      vat_amount: Number(order.vat_amount),
      tax_amount: Number(order.tax_amount),
      shipping_cost: Number(order.shipping_cost),
      discount_amount: Number(order.discount_amount),
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

// POST - Receive purchase order
router.post(
  "/orders/:orderId/receive",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const currentUser = req.user!;

    if (!currentUser.branch_id) {
      throw new AppError("User not assigned to a branch", 400);
    }

    const result = await PurchaseService.receivePurchaseOrder(
      database.sequelize!,
      orderId,
      currentUser.branch_id,
      currentUser.id,
      req.body,
    );

    res.json(result);
  }),
);

// PUT - Update purchase order
router.put(
  "/orders/:orderId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);
    const updateData = req.body;

    const purchaseOrder = await PurchaseOrder.findByPk(orderId);
    if (!purchaseOrder) {
      throw new AppError("Purchase order not found", 404);
    }

    if (updateData.status) purchaseOrder.status = updateData.status;
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
      const product = await Product.findByPk(item.product_id);
      items.push({
        id: item.id,
        product_id: item.product_id,
        product_name: product?.name || null,
        quantity_ordered: Number(item.quantity_ordered),
        unit_cost: Number(item.unit_cost),
        notes: item.notes,
        quantity_received: Number(item.quantity_received),
        total_cost: Number(item.total_cost),
        received_at: item.received_at,
      });
    }

    res.json({
      id: purchaseOrder.id,
      order_number: purchaseOrder.order_number,
      branch_id: purchaseOrder.branch_id,
      supplier: purchaseOrder.supplier,
      expected_delivery_date: purchaseOrder.expected_delivery_date,
      order_date: purchaseOrder.order_date,
      actual_delivery_date: purchaseOrder.actual_delivery_date,
      status: purchaseOrder.status,
      subtotal: Number(purchaseOrder.subtotal),
      vat_rate: Number(purchaseOrder.vat_rate),
      vat_amount: Number(purchaseOrder.vat_amount),
      tax_amount: Number(purchaseOrder.tax_amount),
      shipping_cost: Number(purchaseOrder.shipping_cost),
      discount_amount: Number(purchaseOrder.discount_amount),
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

// DELETE - Delete purchase order
router.delete(
  "/orders/:orderId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orderId = parseInt(req.params.orderId as string);

    const purchaseOrder = await PurchaseOrder.findByPk(orderId);
    if (!purchaseOrder) {
      throw new AppError("Purchase order not found", 404);
    }

    if (purchaseOrder.status !== "pending") {
      throw new AppError("Cannot delete non-pending purchase orders", 400);
    }

    await purchaseOrder.destroy();

    res.status(204).send();
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

    const purchaseOrders = await PurchaseOrder.findAll({
      where: {
        order_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    const purchases = await Purchase.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    let totalPurchaseCost = 0;
    let totalVatAmount = 0;
    for (const po of purchaseOrders) {
      totalPurchaseCost += Number(po.total_amount);
      totalVatAmount += Number(po.vat_amount);
    }

    let totalLegacyCost = 0;
    for (const p of purchases) {
      totalLegacyCost += Number(p.total_amount);
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

    const supplierTotals: Record<string, number> = {};
    for (const po of purchaseOrders) {
      supplierTotals[po.supplier] =
        (supplierTotals[po.supplier] || 0) + Number(po.total_amount);
    }
    for (const p of purchases) {
      if (p.supplier_name) {
        supplierTotals[p.supplier_name] =
          (supplierTotals[p.supplier_name] || 0) + Number(p.total_amount);
      }
    }

    res.json({
      date_range: {
        from_date: startDate.toISOString().split("T")[0],
        to_date: endDate.toISOString().split("T")[0],
      },
      summary: {
        total_purchase_orders: purchaseOrders.length,
        total_purchase_cost: totalPurchaseCost,
        total_vat_amount: totalVatAmount,
        total_legacy_purchases: purchases.length,
        total_legacy_cost: totalLegacyCost,
        total_all_purchases: totalPurchaseCost + totalLegacyCost,
        average_order_value:
          purchaseOrders.length > 0
            ? totalPurchaseCost / purchaseOrders.length
            : 0,
      },
      bank_account_summary: Object.values(bankAccountSummary),
      supplier_breakdown: Object.entries(supplierTotals)
        .map(([supplier, amount]) => ({ supplier, total_amount: amount }))
        .sort((a, b) => b.total_amount - a.total_amount),
      purchase_orders: purchaseOrders.slice(0, 20).map((po) => ({
        order_number: po.order_number,
        supplier: po.supplier,
        order_date: po.order_date,
        total_amount: Number(po.total_amount),
        vat_amount: Number(po.vat_amount),
        vat_rate: Number(po.vat_rate),
        status: po.status,
        items_count: po.items?.length || 0,
      })),
    });
  }),
);

export default router;
