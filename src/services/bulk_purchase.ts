import { Sequelize, Op } from "sequelize";
import { BulkProduct } from "../models/bulk_product.js";
import {
  BulkPurchaseOrder,
  BulkPurchaseStatus,
} from "../models/bulk_purchase_order.js";
import { BulkPurchaseOrderItem } from "../models/bulk_purchase_order_item.js";
import { BulkStock } from "../models/bulk_stock.js";
import { BulkStockMovement } from "../models/bulk_stock_movement.js";
import { BulkAlert } from "../models/bulk_alert.js";
import { Branch } from "../models/branch.js";
import { BankAccount } from "../models/bank_account.js";
import { User } from "../models/user.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

// Generate unique order number for bulk purchases
export function generateBulkOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `BPO-${year}${month}${day}-${random}`;
}

export interface BulkTotalsCalculation {
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
}

export interface BulkOrderItemData {
  bulk_product_id: number;
  selected_category?: string | null;
  total_area: number;
  buying_price: number;
  notes?: string | null;
}

export interface ReceiveBulkItemData {
  bulk_product_id: number;
  selected_category?: string | null;
  total_area_received: number;
}

export class BulkPurchaseService {
  /**
   * Calculate totals for bulk purchase order
   */
  static calculateTotals(
    subtotal: number,
    vatRate?: number | null,
    taxAmount: number = 0,
    shippingCost: number = 0,
    discountAmount: number = 0,
  ): BulkTotalsCalculation {
    let vatAmount = 0;
    let actualVatRate = 0;

    if (vatRate && vatRate > 0) {
      actualVatRate = vatRate;
      vatAmount = subtotal * (vatRate / 100);
    } else if (taxAmount > 0) {
      vatAmount = taxAmount;
      if (subtotal > 0) {
        actualVatRate = (taxAmount / subtotal) * 100;
      }
    }

    const totalAmount = subtotal + vatAmount + shippingCost - discountAmount;

    return {
      subtotal,
      vat_rate: actualVatRate,
      vat_amount: vatAmount,
      total_amount: totalAmount,
    };
  }

  /**
   * Create a bulk purchase order
   */
  static async createBulkPurchaseOrder(
    sequelize: Sequelize,
    branchId: number,
    userId: number,
    purchaseData: any,
  ): Promise<any> {
    // Calculate subtotal from items
    let subtotal = 0;
    const itemsWithDetails = [];

    for (const item of purchaseData.items) {
      const totalArea = Number(item.total_area);
      const buyingPrice = Number(item.buying_price);
      const itemTotal = totalArea * buyingPrice;
      subtotal += itemTotal;

      // Validate product exists
      const product = await BulkProduct.findByPk(item.bulk_product_id);
      if (!product) {
        throw new AppError(
          `Bulk product ID ${item.bulk_product_id} not found`,
          404,
        );
      }

      // Validate category if provided
      if (
        item.selected_category &&
        !product.category_options.includes(item.selected_category)
      ) {
        throw new AppError(
          `Category "${item.selected_category}" not found for product ${product.name}`,
          400,
        );
      }

      itemsWithDetails.push({
        ...item,
        product_name: product.name,
        unit_of_measure: product.unit_of_measure,
        item_total: itemTotal,
      });
    }

    // Calculate totals with VAT
    const vatRate = purchaseData.vat_rate ? Number(purchaseData.vat_rate) : 15;
    const shipping = purchaseData.shipping_cost
      ? Number(purchaseData.shipping_cost)
      : 0;
    const discount = purchaseData.discount_amount
      ? Number(purchaseData.discount_amount)
      : 0;

    const totals = this.calculateTotals(
      subtotal,
      vatRate,
      0,
      shipping,
      discount,
    );

    // Get bank account info if provided
    let bankAccountName = null;
    let bankName = null;
    if (purchaseData.bank_account_id) {
      const bankAccount = await BankAccount.findOne({
        where: {
          id: purchaseData.bank_account_id,
          branch_id: branchId,
          is_active: true,
        },
      });
      if (!bankAccount) {
        throw new AppError("Bank account not found or inactive", 404);
      }
      bankAccountName = bankAccount.account_name;
      bankName = bankAccount.bank_name;
    }

    // Create purchase order
    const purchaseOrder = await BulkPurchaseOrder.create({
      order_number: generateBulkOrderNumber(),
      branch_id: branchId,
      supplier: purchaseData.supplier,
      vat_rate: totals.vat_rate,
      tax_amount: totals.vat_amount,
      total_amount: totals.total_amount,
      notes: purchaseData.notes,
      status: "pending" as BulkPurchaseStatus,
      created_by: userId,
      bank_account_id: purchaseData.bank_account_id,
      payment_reference: purchaseData.payment_reference,
      payment_date: purchaseData.payment_date,
    });

    // Create purchase order items
    const items = [];
    for (const item of purchaseData.items) {
      const totalArea = Number(item.total_area);
      const buyingPrice = Number(item.buying_price);
      const totalCost = totalArea * buyingPrice;

      const purchaseItem = await BulkPurchaseOrderItem.create({
        bulk_purchase_order_id: purchaseOrder.id,
        bulk_product_id: item.bulk_product_id,
        selected_category: item.selected_category || null,
        total_area: totalArea,
        buying_price: buyingPrice,
        total_cost: totalCost,
        notes: item.notes || null,
      });

      const product = await BulkProduct.findByPk(item.bulk_product_id);

      items.push({
        id: purchaseItem.id,
        bulk_product_id: purchaseItem.bulk_product_id,
        product_name: product?.name || "Unknown",
        selected_category: purchaseItem.selected_category,
        total_area: Number(purchaseItem.total_area),
        buying_price: Number(purchaseItem.buying_price),
        total_cost: Number(purchaseItem.total_cost),
        notes: purchaseItem.notes,
      });
    }

    const creator = await User.findByPk(userId);

    logger.info(
      `Bulk purchase order created: ${purchaseOrder.order_number} by ${creator?.name || userId}`,
    );

    return {
      id: purchaseOrder.id,
      order_number: purchaseOrder.order_number,
      branch_id: purchaseOrder.branch_id,
      supplier: purchaseOrder.supplier,
      status: purchaseOrder.status,
      subtotal: subtotal,
      vat_rate: Number(purchaseOrder.vat_rate),
      vat_amount: Number(purchaseOrder.tax_amount),
      total_amount: Number(purchaseOrder.total_amount),
      notes: purchaseOrder.notes,
      created_by: creator?.name || "System",
      created_at: purchaseOrder.created_at,
      updated_at: purchaseOrder.updated_at,
      items: items,
      bank_account_id: purchaseOrder.bank_account_id,
      bank_account_name: bankAccountName,
      bank_name: bankName,
      payment_reference: purchaseOrder.payment_reference,
      payment_date: purchaseOrder.payment_date,
    };
  }

  /**
   * Receive a bulk purchase order
   */
  static async receiveBulkPurchaseOrder(
    sequelize: Sequelize,
    orderId: number,
    branchId: number,
    userId: number,
    receiveData: any,
  ): Promise<any> {
    const purchaseOrder = await BulkPurchaseOrder.findByPk(orderId);
    if (!purchaseOrder) {
      throw new AppError("Bulk purchase order not found", 404);
    }

    if (purchaseOrder.status === "completed") {
      throw new AppError("Bulk purchase order already completed", 400);
    }

    const hasVat = purchaseOrder.vat_rate && purchaseOrder.vat_rate > 0;
    const receivedItems = [];

    for (const receiveItem of receiveData.items) {
      const purchaseItem = await BulkPurchaseOrderItem.findOne({
        where: {
          bulk_purchase_order_id: orderId,
          bulk_product_id: receiveItem.bulk_product_id,
          selected_category: receiveItem.selected_category || null,
        },
      });

      if (!purchaseItem) {
        throw new AppError(
          `Product ID ${receiveItem.bulk_product_id} with category ${receiveItem.selected_category || "uncategorized"} not found in purchase order`,
          404,
        );
      }

      const areaReceived = Number(receiveItem.total_area_received);
      await purchaseItem.save();

      // Get product details
      const product = await BulkProduct.findByPk(purchaseItem.bulk_product_id);
      if (!product) {
        throw new AppError(
          `Bulk product ID ${purchaseItem.bulk_product_id} not found`,
          404,
        );
      }

      // Update or create stock record
      let stock = await BulkStock.findOne({
        where: {
          branch_id: branchId,
          bulk_product_id: purchaseItem.bulk_product_id,
          category: purchaseItem.selected_category || null,
        },
      });

      if (stock) {
        stock.total_area = Number(stock.total_area) + areaReceived;
        await stock.save();
      } else {
        stock = await BulkStock.create({
          branch_id: branchId,
          bulk_product_id: purchaseItem.bulk_product_id,
          category: purchaseItem.selected_category || null,
          total_area: areaReceived,
          reorder_level: 10, // Default reorder level
        });
      }

      // Create stock movement record
      await BulkStockMovement.create({
        bulk_stock_id: stock.id,
        quantity: areaReceived,
        type: "purchase",
        reference_id: purchaseOrder.id,
        reference_type: "BulkPurchaseOrder",
        notes: `Received from PO: ${purchaseOrder.order_number} - Category: ${purchaseItem.selected_category || "uncategorized"}`,
      });

      // Check if stock is low and create alert
      if (Number(stock.total_area) <= Number(stock.reorder_level)) {
        await BulkAlert.create({
          bulk_product_id: purchaseItem.bulk_product_id,
          branch_id: branchId,
          category: purchaseItem.selected_category || null,
          message: `Low stock alert: ${product.name} ${purchaseItem.selected_category ? `(${purchaseItem.selected_category})` : ""} has ${stock.total_area} ${product.unit_of_measure} remaining. Reorder level is ${stock.reorder_level} ${product.unit_of_measure}.`,
          is_read: false,
        });
      }

      receivedItems.push({
        bulk_product_id: purchaseItem.bulk_product_id,
        product_name: product.name,
        selected_category: purchaseItem.selected_category,
        unit_of_measure: product.unit_of_measure,
        area_received: areaReceived,
        buying_price: Number(purchaseItem.buying_price),
        total_cost: Number(purchaseItem.buying_price) * areaReceived,
        branch_id: branchId,
        with_vat: hasVat,
      });
    }

    // Check if all items are fully received
    const allItems = await BulkPurchaseOrderItem.findAll({
      where: { bulk_purchase_order_id: orderId },
    });

    purchaseOrder.status = allItems
      ? ("completed" as BulkPurchaseStatus)
      : ("partially_received" as BulkPurchaseStatus);
    purchaseOrder.actual_delivery_date =
      receiveData.actual_delivery_date || new Date();
    purchaseOrder.updated_at = new Date();
    await purchaseOrder.save();

    logger.info(
      `Bulk purchase order received: ${purchaseOrder.order_number}, status: ${purchaseOrder.status}`,
    );

    return {
      success: true,
      message: "Bulk purchase order received successfully",
      status: purchaseOrder.status,
      order_number: purchaseOrder.order_number,
      branch_id: branchId,
      has_vat: hasVat,
      received_items: receivedItems,
      total_items_received: receivedItems.length,
    };
  }

  /**
   * Get all bulk purchase orders with optional filtering
   */
  static async getBulkPurchaseOrders(
    sequelize: Sequelize,
    options?: {
      branchId?: number;
      status?: BulkPurchaseStatus;
      supplier?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    const where: any = {};

    if (options?.branchId) {
      where.branch_id = options.branchId;
    }
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.supplier) {
      where.supplier = { [Op.iLike]: `%${options.supplier}%` };
    }
    if (options?.startDate || options?.endDate) {
      where.created_at = {};
      if (options.startDate) {
        where.created_at[Op.gte] = options.startDate;
      }
      if (options.endDate) {
        where.created_at[Op.lte] = options.endDate;
      }
    }

    const orders = await BulkPurchaseOrder.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });

    const result = [];
    for (const order of orders) {
      const items = await BulkPurchaseOrderItem.findAll({
        where: { bulk_purchase_order_id: order.id },
        include: [
          {
            model: BulkProduct,
            as: "product",
            attributes: ["name", "unit_of_measure"],
          },
        ],
      });

      const creator = await User.findByPk(order.created_by);

      result.push({
        id: order.id,
        order_number: order.order_number,
        branch_id: order.branch_id,
        supplier: order.supplier,
        status: order.status,
        subtotal: Number(order.subtotal),
        vat_rate: Number(order.vat_rate),
        vat_amount: Number(order.tax_amount),
        total_amount: Number(order.total_amount),
        notes: order.notes,
        created_by: creator?.name || "System",
        created_at: order.created_at,
        updated_at: order.updated_at,
        expected_delivery_date: order.expected_delivery_date,
        actual_delivery_date: order.actual_delivery_date,
        items: items.map((item) => ({
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
      });
    }

    return result;
  }

  /**
   * Get a single bulk purchase order by ID
   */
  static async getBulkPurchaseOrderById(
    sequelize: Sequelize,
    orderId: number,
  ): Promise<any | null> {
    const order = await BulkPurchaseOrder.findByPk(orderId);
    if (!order) {
      return null;
    }

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

    const creator = await User.findByPk(order.created_by);

    return {
      id: order.id,
      order_number: order.order_number,
      branch_id: order.branch_id,
      supplier: order.supplier,
      status: order.status,
      subtotal: Number(order.subtotal),
      vat_rate: Number(order.vat_rate),
      vat_amount: Number(order.tax_amount),
      total_amount: Number(order.total_amount),
      notes: order.notes,
      created_by: creator?.name || "System",
      created_at: order.created_at,
      updated_at: order.updated_at,
      expected_delivery_date: order.expected_delivery_date,
      actual_delivery_date: order.actual_delivery_date,
      items: items.map((item) => ({
        id: item.id,
        bulk_product_id: item.bulk_product_id,
        product_name: (item as any).product?.name || "Unknown",
        unit_of_measure: (item as any).product?.unit_of_measure || "m²",
        category_options: (item as any).product?.category_options || [],
        selected_category: item.selected_category,
        total_area: Number(item.total_area),
        buying_price: Number(item.buying_price),
        total_cost: Number(item.total_cost),
        notes: item.notes,
      })),
    };
  }

  /**
   * Get bulk purchase order by order number
   */
  static async getBulkPurchaseOrderByNumber(
    sequelize: Sequelize,
    orderNumber: string,
  ): Promise<any | null> {
    const order = await BulkPurchaseOrder.findOne({
      where: { order_number: orderNumber },
    });
    if (!order) {
      return null;
    }
    return this.getBulkPurchaseOrderById(sequelize, order.id);
  }

  /**
   * Update bulk purchase order status
   */
  static async updateBulkPurchaseOrderStatus(
    sequelize: Sequelize,
    orderId: number,
    status: BulkPurchaseStatus,
  ): Promise<boolean> {
    const order = await BulkPurchaseOrder.findByPk(orderId);
    if (!order) {
      return false;
    }

    order.status = status;
    order.updated_at = new Date();
    await order.save();

    logger.info(
      `Bulk purchase order ${order.order_number} status updated to ${status}`,
    );
    return true;
  }

  /**
   * Cancel bulk purchase order
   */
  static async cancelBulkPurchaseOrder(
    sequelize: Sequelize,
    orderId: number,
    reason?: string,
  ): Promise<boolean> {
    const order = await BulkPurchaseOrder.findByPk(orderId);
    if (!order) {
      return false;
    }

    if (order.status === "completed") {
      throw new AppError("Cannot cancel a completed purchase order", 400);
    }

    if (order.status === "partially_received") {
      throw new AppError(
        "Cannot cancel a partially received purchase order. Please process returns first.",
        400,
      );
    }

    order.status = "cancelled" as BulkPurchaseStatus;
    order.notes = order.notes
      ? `${order.notes}\nCancelled: ${reason || "No reason provided"}`
      : `Cancelled: ${reason || "No reason provided"}`;
    order.updated_at = new Date();
    await order.save();

    logger.info(`Bulk purchase order ${order.order_number} cancelled`);
    return true;
  }

  /**
   * Get bulk purchase order statistics
   */
  static async getBulkPurchaseStatistics(
    sequelize: Sequelize,
    branchId?: number,
  ): Promise<any> {
    const where: any = {};
    if (branchId) {
      where.branch_id = branchId;
    }

    const totalOrders = await BulkPurchaseOrder.count({ where });
    const pendingOrders = await BulkPurchaseOrder.count({
      where: { ...where, status: "pending" },
    });
    const completedOrders = await BulkPurchaseOrder.count({
      where: { ...where, status: "completed" },
    });
    const partiallyReceivedOrders = await BulkPurchaseOrder.count({
      where: { ...where, status: "partially_received" },
    });
    const cancelledOrders = await BulkPurchaseOrder.count({
      where: { ...where, status: "cancelled" },
    });

    const totalAmountResult = await BulkPurchaseOrder.sum("total_amount", {
      where,
    });
    const totalAmount = totalAmountResult || 0;

    return {
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      completed_orders: completedOrders,
      partially_received_orders: partiallyReceivedOrders,
      cancelled_orders: cancelledOrders,
      total_amount: Number(totalAmount),
      average_order_value:
        totalOrders > 0 ? Number(totalAmount) / totalOrders : 0,
    };
  }

  /**
   * Get recent bulk purchase orders
   */
  static async getRecentBulkPurchaseOrders(
    sequelize: Sequelize,
    limit: number = 10,
    branchId?: number,
  ): Promise<any[]> {
    const where: any = {};
    if (branchId) {
      where.branch_id = branchId;
    }

    const orders = await BulkPurchaseOrder.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
    });

    const result = [];
    for (const order of orders) {
      const itemCount = await BulkPurchaseOrderItem.count({
        where: { bulk_purchase_order_id: order.id },
      });

      result.push({
        id: order.id,
        order_number: order.order_number,
        supplier: order.supplier,
        status: order.status,
        total_amount: Number(order.total_amount),
        item_count: itemCount,
        created_at: order.created_at,
      });
    }

    return result;
  }
}
