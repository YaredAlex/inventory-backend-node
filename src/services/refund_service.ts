import { Sequelize, Op } from "sequelize";
import { RefundStatus, Sale, SaleStatus } from "../models/sale.js";
import { SaleItem } from "../models/sale_item.js";
import { Refund } from "../models/refund.js";
import { RefundItem } from "../models/refund_item.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { MovementType, StockMovement } from "../models/stock_movement.js";
import { Branch } from "../models/branch.js";
import { BankAccount } from "../models/bank_account.js";
import { User } from "../models/user.js";
import { AppError } from "../middleware/error_handle.js";
import { generateRefundNumber } from "../schemas/sale.js";
import logger from "../services/logger.js";

export interface RefundItemInfo {
  saleItem: SaleItem;
  quantity: number;
  refundAmount: number;
  reason?: string | null;
}

export class RefundService {
  static async validateRefundItems(
    sequelize: Sequelize,
    originalSaleId: number,
    items: any[],
  ): Promise<{ items: RefundItemInfo[]; totalRefundAmount: number }> {
    let totalRefundAmount = 0;
    const refundItems: RefundItemInfo[] = [];

    for (const refundItem of items) {
      const saleItem = await SaleItem.findByPk(refundItem.sale_item_id);
      if (!saleItem) {
        throw new AppError(
          `Sale item ${refundItem.sale_item_id} not found`,
          404,
        );
      }

      if (saleItem.sale_id !== originalSaleId) {
        throw new AppError("Item does not belong to this sale", 400);
      }

      // Check already refunded quantity
      const alreadyRefunded = await RefundItem.findAll({
        where: { sale_item_id: saleItem.id },
      });

      const alreadyRefundedQty = alreadyRefunded.reduce(
        (sum, r) => sum + Number(r.quantity),
        0,
      );
      const maxRefundable = Number(saleItem.quantity) - alreadyRefundedQty;

      if (refundItem.quantity > maxRefundable) {
        throw new AppError(
          `Cannot refund ${refundItem.quantity} of item ${saleItem.id}. Max refundable: ${maxRefundable}`,
          400,
        );
      }

      const refundAmount = refundItem.quantity * Number(saleItem.unit_price);
      totalRefundAmount += refundAmount;

      refundItems.push({
        saleItem,
        quantity: refundItem.quantity,
        refundAmount,
        reason: refundItem.reason,
      });
    }

    return { items: refundItems, totalRefundAmount };
  }

  static async createRefund(
    sequelize: Sequelize,
    refundData: any,
    userId: number,
  ): Promise<any> {
    // Get original sale
    const originalSale = await Sale.findByPk(refundData.original_sale_id);
    if (!originalSale) {
      throw new AppError("Original sale not found", 404);
    }

    if (originalSale.status === SaleStatus.COMPLETED) {
      throw new AppError("This sale has already been fully refunded", 400);
    }

    // Validate refund method
    if (refundData.refund_method === "bank_transfer") {
      if (!refundData.bank_account_id) {
        throw new AppError(
          "Bank account ID is required for transfer refunds",
          400,
        );
      }

      const bankAccount = await BankAccount.findOne({
        where: {
          id: refundData.bank_account_id,
          is_active: true,
        },
      });

      if (!bankAccount) {
        throw new AppError("Bank account not found or inactive", 404);
      }
    }

    // Validate refund items
    const { items, totalRefundAmount } = await this.validateRefundItems(
      sequelize,
      originalSale.id,
      refundData.items,
    );

    // Create refund
    const refundNumber = generateRefundNumber();
    const refund = await Refund.create({
      refund_number: refundNumber,
      original_sale_id: originalSale.id,
      branch_id: originalSale.branch_id,
      user_id: userId,
      customer_name: originalSale.customer_name,
      refund_amount: totalRefundAmount,
      refund_reason: refundData.refund_reason,
      refund_method: refundData.refund_method,
      bank_account_id: refundData.bank_account_id || null,
      transaction_reference: refundData.transaction_reference || null,
      status: RefundStatus.COMPLETED,
      notes: refundData.notes || null,
      completed_at: new Date(),
    });

    // Create refund items and update stock
    for (const item of items) {
      await RefundItem.create({
        refund_id: refund.id,
        sale_item_id: item.saleItem.id,
        product_id: item.saleItem.product_id,
        quantity: item.quantity,
        unit_price: item.saleItem.unit_price,
        refund_amount: item.refundAmount,
        reason: item.reason || null,
      });

      // Update stock - add back the refunded quantity
      const stock = await Stock.findOne({
        where: {
          branch_id: originalSale.branch_id,
          product_id: item.saleItem.product_id,
        },
      });

      if (stock) {
        stock.quantity = Number(stock.quantity) + item.quantity;
        await stock.save();

        await StockMovement.create({
          branch_id: originalSale.branch_id,
          product_id: item.saleItem.product_id,
          user_id: userId,
          change_qty: item.quantity,
          movement_type: MovementType.REFUND,
          reference_id: refund.id,
          notes: `Refund for sale ${originalSale.invoice_number}`,
        });
      }
    }

    // Update the original sale
    originalSale.refund_amount =
      Number(originalSale.refund_amount) + totalRefundAmount;

    if (
      Number(originalSale.refund_amount) >= Number(originalSale.total_amount)
    ) {
      originalSale.status = "refunded" as SaleStatus;
      originalSale.refund_status = RefundStatus.COMPLETED;
    } else {
      originalSale.status = "partially_refunded" as SaleStatus;
      originalSale.refund_status = RefundStatus.PARTIAL;
    }

    await originalSale.save();

    return { refund, items, originalSale };
  }

  static async formatRefundResponse(
    sequelize: Sequelize,
    refund: Refund,
    items: RefundItemInfo[],
    originalSale: Sale,
    user: User,
  ): Promise<any> {
    const branch = await Branch.findByPk(refund.branch_id);

    // Get bank account details if present
    let bankAccountDetails = null;
    if (refund.bank_account_id) {
      const bankAccount = await BankAccount.findByPk(refund.bank_account_id);
      if (bankAccount) {
        const bankBranch = await Branch.findByPk(bankAccount.branch_id);
        bankAccountDetails = {
          id: bankAccount.id,
          branch_id: bankAccount.branch_id,
          branch_name: bankBranch?.name || null,
          bank_name: bankAccount.bank_name,
          account_number: bankAccount.account_number,
          account_name: bankAccount.account_name,
          account_type: bankAccount.account_type,
          currency: bankAccount.currency,
          is_active: bankAccount.is_active,
          notes: bankAccount.notes,
          created_at: bankAccount.created_at,
          updated_at: bankAccount.updated_at,
        };
      }
    }

    const responseItems = [];
    for (const item of items) {
      const product = await Product.findByPk(item.saleItem.product_id);
      responseItems.push({
        id: 0,
        sale_item_id: item.saleItem.id,
        product_id: item.saleItem.product_id,
        product_name: product?.name || null,
        quantity: item.quantity,
        unit_price: Number(item.saleItem.unit_price),
        refund_amount: item.refundAmount,
        reason: item.reason,
      });
    }

    return {
      id: refund.id,
      refund_number: refund.refund_number,
      original_sale_id: refund.original_sale_id,
      original_invoice_number: originalSale.invoice_number,
      branch_id: refund.branch_id,
      branch_name: branch?.name || null,
      user_id: refund.user_id,
      user_name: user.name,
      customer_name: refund.customer_name,
      refund_amount: Number(refund.refund_amount),
      refund_reason: refund.refund_reason,
      refund_method: refund.refund_method,
      bank_account_id: refund.bank_account_id,
      bank_account_details: bankAccountDetails,
      transaction_reference: refund.transaction_reference,
      status: refund.status,
      approved_by: null,
      approved_at: null,
      created_at: refund.created_at,
      completed_at: refund.completed_at,
      notes: refund.notes,
      items: responseItems,
    };
  }
}
