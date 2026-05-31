import { Sequelize, Op } from "sequelize";
import { RefundStatus, Sale, SaleStatus } from "../models/sale.js";
import { SaleItem } from "../models/sale_item.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { MovementType, StockMovement } from "../models/stock_movement.js";
import { Branch } from "../models/branch.js";
import { BankAccount } from "../models/bank_account.js";
import { User } from "../models/user.js";
import { AppError } from "../middleware/error_handle.js";
import { generateInvoiceNumber } from "../schemas/sale.js";
import logger from "../services/logger.js";

export interface SaleItemInfo {
  product: Product;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface CalculatedTotals {
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  total_cost: number;
}

export class SaleService {
  static calculateTotals(
    subtotal: number,
    taxRate: number,
    discountAmount: number,
    discountType: string,
    shippingCost: number,
  ): CalculatedTotals {
    const taxAmount = subtotal * (taxRate / 100);

    let actualDiscount = discountAmount;
    if (discountType === "percentage") {
      actualDiscount = subtotal * (discountAmount / 100);
    }

    const totalAmount = subtotal + taxAmount + shippingCost - actualDiscount;

    return {
      subtotal,
      tax_amount: taxAmount,
      discount_amount: actualDiscount,
      total_amount: totalAmount,
      total_cost: 0, // Will be calculated separately
    };
  }

  static async validateAndProcessSaleItems(
    sequelize: Sequelize,
    branchId: number,
    userId: number,
    items: any[],
    saleId?: number,
  ): Promise<{ items: SaleItemInfo[]; subtotal: number; totalCost: number }> {
    let subtotal = 0;
    let totalCost = 0;
    const saleItems: SaleItemInfo[] = [];

    for (const itemData of items) {
      const product = await Product.findByPk(itemData.product_id);
      if (!product) {
        throw new AppError(`Product ${itemData.product_id} not found`, 404);
      }

      const quantity = Number(itemData.quantity);
      const unitPrice = Number(itemData.unit_price);
      const productCost = Number(product.cost);
      const itemDiscount = Number(itemData.discount_amount) || 0;

      // Check stock availability
      const stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: itemData.product_id,
        },
      });

      if (!stock) {
        throw new AppError(
          `No stock record found for product ${product.name}`,
          400,
        );
      }

      if (Number(stock.quantity) < quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${Number(stock.quantity)}, Requested: ${quantity}`,
          400,
        );
      }

      const lineSubtotal = quantity * unitPrice;
      const lineTotal = lineSubtotal - itemDiscount;
      const lineCost = quantity * productCost;

      subtotal += lineSubtotal;
      totalCost += lineCost;

      // Update stock
      stock.quantity = Number(stock.quantity) - quantity;
      await stock.save();

      // Record stock movement
      await StockMovement.create({
        branch_id: branchId,
        product_id: itemData.product_id,
        user_id: userId,
        change_qty: -quantity,
        movement_type: MovementType.SALE,
        reference_id: saleId || null,
        notes: `Sale by user ${userId}`,
      });

      saleItems.push({
        product,
        quantity,
        unit_price: unitPrice,
        discount_amount: itemDiscount,
        line_total: lineTotal,
      });
    }

    return { items: saleItems, subtotal, totalCost };
  }

  static async createSale(
    sequelize: Sequelize,
    saleData: any,
    branchId: number,
    userId: number,
  ): Promise<any> {
    // Validate branch
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Validate bank account for transfer payments
    if (saleData.payment_method === "bank_transfer") {
      if (!saleData.bank_account_id) {
        throw new AppError(
          "Bank account ID is required for transfer payments",
          400,
        );
      }

      const bankAccount = await BankAccount.findOne({
        where: {
          id: saleData.bank_account_id,
          branch_id: branchId,
          is_active: true,
        },
      });

      if (!bankAccount) {
        throw new AppError("Bank account not found or inactive", 404);
      }
    }

    // Process items and calculate totals
    const { items, subtotal, totalCost } =
      await this.validateAndProcessSaleItems(
        sequelize,
        branchId,
        userId,
        saleData.items,
      );

    // Calculate financial totals
    const taxRate = saleData.tax_rate || 15;
    const discountAmount = saleData.discount_amount || 0;
    const discountType = saleData.discount_type || "percentage";
    const shippingCost = saleData.shipping_cost || 0;

    const totals = this.calculateTotals(
      subtotal,
      taxRate,
      discountAmount,
      discountType,
      shippingCost,
    );

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create sale
    const sale = await Sale.create({
      invoice_number: invoiceNumber,
      branch_id: branchId,
      user_id: userId,
      customer_name: saleData.customer_name || null,
      customer_phone: saleData.customer_phone || null,
      customer_email: saleData.customer_email || null,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      tax_rate: taxRate,
      discount_amount: totals.discount_amount,
      discount_type: discountType,
      shipping_cost: shippingCost,
      total_amount: totals.total_amount,
      total_cost: totalCost,
      payment_method: saleData.payment_method || "cash",
      bank_account_id: saleData.bank_account_id || null,
      transaction_reference: saleData.transaction_reference || null,
      status: SaleStatus.COMPLETED,
      refund_amount: 0,
      refund_status: RefundStatus.NONE,
      notes: saleData.notes || null,
    });

    // Create sale items
    for (const item of items) {
      await SaleItem.create({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        line_total: item.line_total,
      });
    }

    return { sale, items, branch };
  }

  static async formatSaleResponse(
    sequelize: Sequelize,
    sale: Sale,
    items: SaleItemInfo[],
    branch: Branch,
    user: User,
  ): Promise<any> {
    // Get bank account details if present
    let bankAccountDetails = null;
    if (sale.bank_account_id) {
      const bankAccount = await BankAccount.findByPk(sale.bank_account_id);
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

    const responseItems = items.map((item, index) => ({
      id: index + 1,
      sale_id: sale.id,
      product_id: item.product.id,
      product_name: item.product.name,
      product_sku: item.product.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      line_total: item.line_total,
    }));

    return {
      id: sale.id,
      invoice_number: sale.invoice_number,
      branch_id: sale.branch_id,
      branch_name: branch.name,
      user_id: sale.user_id,
      user_name: user.name,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      customer_email: sale.customer_email,
      subtotal: Number(sale.subtotal),
      tax_amount: Number(sale.tax_amount),
      tax_rate: Number(sale.tax_rate),
      discount_amount: Number(sale.discount_amount),
      discount_type: sale.discount_type,
      shipping_cost: Number(sale.shipping_cost),
      total_amount: Number(sale.total_amount),
      total_cost: Number(sale.total_cost),
      payment_method: sale.payment_method,
      bank_account_id: sale.bank_account_id,
      bank_account_details: bankAccountDetails,
      transaction_reference: sale.transaction_reference,
      status: sale.status,
      refund_amount: Number(sale.refund_amount),
      refund_status: sale.refund_status,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
      notes: sale.notes,
      items: responseItems,
    };
  }
}
