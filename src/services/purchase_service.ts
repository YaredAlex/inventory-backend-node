import { Sequelize, Op } from "sequelize";
import { Purchase } from "../models/purchase.js";
import { PurchaseOrder, PurchaseStatus } from "../models/purchase_order.js";
import { PurchaseOrderItem } from "../models/purchase_order_item.js";
import { PurchaseItem } from "../models/purchase_item.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { MovementType, StockMovement } from "../models/stock_movement.js";
import { BankAccount } from "../models/bank_account.js";
import { User } from "../models/user.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";
import { generateOrderNumber } from "../schemas/purchase.js";

const DEFAULT_VAT_RATE = 15;

export interface TotalsCalculation {
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
}

export class PurchaseService {
  static calculateTotals(
    subtotal: number,
    vatRate?: number | null,
    taxAmount: number = 0,
    shippingCost: number = 0,
    discountAmount: number = 0,
  ): TotalsCalculation {
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

  static async createPurchase(
    sequelize: Sequelize,
    branchId: number,
    userId: number,
    purchaseData: any,
  ): Promise<Purchase> {
    const totalAmount = 0;
    const hasVat = purchaseData.with_vat || false;

    const purchase = await Purchase.create({
      branch_id: branchId,
      supplier_name: purchaseData.supplier_name,
      total_amount: totalAmount,
    });

    let calculatedTotal = 0;

    for (const itemData of purchaseData.items) {
      const product = await Product.findByPk(itemData.product_id);
      if (!product) {
        throw new AppError(`Product ${itemData.product_id} not found`, 404);
      }

      const itemTotal = itemData.quantity * itemData.unit_cost;
      calculatedTotal += itemTotal;

      await PurchaseItem.create({
        purchase_id: purchase.id,
        product_id: itemData.product_id,
        quantity: itemData.quantity,
        unit_cost: itemData.unit_cost,
      });

      let stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: itemData.product_id,
        },
      });

      if (stock) {
        stock.quantity = Number(stock.quantity) + itemData.quantity;
        if (hasVat) {
          stock.quantity_with_vat =
            (Number(stock.quantity_with_vat) || 0) + itemData.quantity;
        } else {
          stock.quantity_without_vat =
            (Number(stock.quantity_without_vat) || 0) + itemData.quantity;
        }
        await stock.save();
      } else {
        stock = await Stock.create({
          branch_id: branchId,
          product_id: itemData.product_id,
          quantity: itemData.quantity,
          quantity_with_vat: hasVat ? itemData.quantity : 0,
          quantity_without_vat: !hasVat ? itemData.quantity : 0,
          reorder_level: 0,
        });
      }

      const vatStatus = hasVat ? "with VAT" : "without VAT";
      await StockMovement.create({
        branch_id: branchId,
        product_id: itemData.product_id,
        user_id: userId,
        change_qty: itemData.quantity,
        movement_type: "purchase" as MovementType,
        reference_id: purchase.id,
        notes: `Purchase from ${purchaseData.supplier_name} - ${vatStatus}`,
        with_vat: hasVat,
      });
    }

    purchase.total_amount = calculatedTotal;
    await purchase.save();

    return purchase;
  }

  static async createPurchaseOrder(
    sequelize: Sequelize,
    branchId: number,
    userId: number,
    purchaseData: any,
  ): Promise<any> {
    let subtotal = 0;
    for (const item of purchaseData.items) {
      const quantity = Number(item.quantity_ordered);
      const cost = Number(item.unit_cost);
      subtotal += quantity * cost;
    }

    const vatRate = purchaseData.vat_rate
      ? Number(purchaseData.vat_rate)
      : null;
    const taxAmount = purchaseData.tax_amount
      ? Number(purchaseData.tax_amount)
      : 0;
    const shipping = purchaseData.shipping_cost
      ? Number(purchaseData.shipping_cost)
      : 0;
    const discount = purchaseData.discount_amount
      ? Number(purchaseData.discount_amount)
      : 0;

    const totals = this.calculateTotals(
      subtotal,
      vatRate,
      taxAmount,
      shipping,
      discount,
    );

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

    const purchaseOrder = await PurchaseOrder.create({
      order_number: generateOrderNumber(),
      branch_id: branchId,
      supplier: purchaseData.supplier,
      expected_delivery_date: purchaseData.expected_delivery_date,
      subtotal: totals.subtotal,
      vat_rate: totals.vat_rate,
      vat_amount: totals.vat_amount,
      tax_amount: totals.vat_amount,
      shipping_cost: shipping,
      discount_amount: discount,
      total_amount: totals.total_amount,
      notes: purchaseData.notes,
      created_by: userId,
      status: "pending" as PurchaseStatus,
      bank_account_id: purchaseData.bank_account_id,
      payment_reference: purchaseData.payment_reference,
      payment_date: purchaseData.payment_date,
    });

    const items = [];
    for (const itemData of purchaseData.items) {
      const product = await Product.findByPk(itemData.product_id);
      if (!product) {
        throw new AppError(`Product ${itemData.product_id} not found`, 404);
      }

      const quantity = Number(itemData.quantity_ordered);
      const cost = Number(itemData.unit_cost);

      const purchaseItem = await PurchaseOrderItem.create({
        purchase_order_id: purchaseOrder.id,
        product_id: itemData.product_id,
        quantity_ordered: quantity,
        unit_cost: cost,
        total_cost: quantity * cost,
        notes: itemData.notes,
        quantity_received: 0,
      });

      items.push({
        id: purchaseItem.id,
        product_id: purchaseItem.product_id,
        product_name: product.name,
        quantity_ordered: Number(purchaseItem.quantity_ordered),
        unit_cost: Number(purchaseItem.unit_cost),
        notes: purchaseItem.notes,
        quantity_received: Number(purchaseItem.quantity_received),
        total_cost: Number(purchaseItem.total_cost),
        received_at: purchaseItem.received_at,
      });
    }

    const creator = await User.findByPk(userId);

    return {
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
      items: items,
      bank_account_id: purchaseOrder.bank_account_id,
      bank_account_name: bankAccountName,
      bank_name: bankName,
      payment_reference: purchaseOrder.payment_reference,
      payment_date: purchaseOrder.payment_date,
    };
  }

  static async receivePurchaseOrder(
    sequelize: Sequelize,
    orderId: number,
    branchId: number,
    userId: number,
    receiveData: any,
  ): Promise<any> {
    const purchaseOrder = await PurchaseOrder.findByPk(orderId);
    if (!purchaseOrder) {
      throw new AppError("Purchase order not found", 404);
    }

    if (purchaseOrder.status === "completed") {
      throw new AppError("Purchase order already completed", 400);
    }

    const hasVat = purchaseOrder.vat_rate && purchaseOrder.vat_rate > 0;
    const receivedItems = [];

    for (const receiveItem of receiveData.items) {
      const purchaseItem = await PurchaseOrderItem.findOne({
        where: {
          purchase_order_id: orderId,
          product_id: receiveItem.product_id,
        },
      });

      if (!purchaseItem) {
        throw new AppError(
          `Product ID ${receiveItem.product_id} not found in purchase order`,
          404,
        );
      }

      const quantityReceived = Number(receiveItem.quantity_received);
      const newReceived =
        Number(purchaseItem.quantity_received) + quantityReceived;

      if (newReceived > Number(purchaseItem.quantity_ordered)) {
        const remaining =
          Number(purchaseItem.quantity_ordered) -
          Number(purchaseItem.quantity_received);
        throw new AppError(
          `Cannot receive ${quantityReceived} units. Only ${remaining} units remaining.`,
          400,
        );
      }

      purchaseItem.quantity_received = newReceived;
      purchaseItem.received_at = new Date();
      await purchaseItem.save();

      const product = await Product.findByPk(purchaseItem.product_id);

      let stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: purchaseItem.product_id,
        },
      });

      if (stock) {
        stock.quantity = Number(stock.quantity) + quantityReceived;

        if (hasVat) {
          stock.quantity_with_vat =
            (Number(stock.quantity_with_vat) || 0) + quantityReceived;
        } else {
          stock.quantity_without_vat =
            (Number(stock.quantity_without_vat) || 0) + quantityReceived;
        }

        await stock.save();
      } else {
        stock = await Stock.create({
          branch_id: branchId,
          product_id: purchaseItem.product_id,
          quantity: quantityReceived,
          quantity_with_vat: hasVat ? quantityReceived : 0,
          quantity_without_vat: !hasVat ? quantityReceived : 0,
          reorder_level: 0,
        });
      }

      const vatStatus = hasVat ? "with VAT" : "without VAT";
      await StockMovement.create({
        branch_id: branchId,
        product_id: purchaseItem.product_id,
        user_id: userId,
        change_qty: quantityReceived,
        movement_type: "purchase" as MovementType,
        reference_id: purchaseOrder.id,
        notes: `Received from PO: ${purchaseOrder.order_number} - ${vatStatus}`,
        with_vat: hasVat as boolean,
      });

      receivedItems.push({
        product_id: purchaseItem.product_id,
        product_name: product?.name || "Unknown",
        quantity_received: quantityReceived,
        unit_cost: Number(purchaseItem.unit_cost),
        total_cost: Number(purchaseItem.unit_cost) * quantityReceived,
        branch_id: branchId,
        with_vat: hasVat,
      });
    }

    const allItems = await PurchaseOrderItem.findAll({
      where: { purchase_order_id: orderId },
    });

    const allItemsReceived = allItems.every(
      (item) => Number(item.quantity_received) >= Number(item.quantity_ordered),
    );

    purchaseOrder.status = allItemsReceived
      ? "completed"as PurchaseStatus
      : "partially_received" as PurchaseStatus;
    purchaseOrder.actual_delivery_date = receiveData.actual_delivery_date;
    purchaseOrder.updated_at = new Date();
    await purchaseOrder.save();

    return {
      success: true,
      message: "Purchase order received successfully",
      status: purchaseOrder.status,
      order_number: purchaseOrder.order_number,
      branch_id: branchId,
      has_vat: hasVat,
      received_items: receivedItems,
      total_items_received: receivedItems.length,
    };
  }
}
