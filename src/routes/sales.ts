import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { database } from "../database.js";
import { Sale } from "../models/sale.js";
import { SaleItem } from "../models/sale_item.js";
import { Refund } from "../models/refund.js";
import { RefundItem } from "../models/refund_item.js";
import { BankAccount } from "../models/bank_account.js";
import { Branch } from "../models/branch.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { SaleService } from "../services/sales_service.js";
import { RefundService } from "../services/refund_service.js";
import { BankAccountService } from "../services/bankaccount_service.js";
import {
  validateSaleCreate,
  validateSaleUpdate,
  validateRefundCreate,
  validateBankAccountCreate,
  validateBankAccountUpdate,
  SaleResponse,
  RefundResponse,
  SaleStatus,
  PaymentMethod,
} from "../schemas/sale.js";
import { requireAuth, requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import { AuthService } from "../services/auth_service.js";
import { EmailService } from "../services/email_service.js";
import { settings } from "../config.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All sale routes require authentication
router.use(requireAuth);

// ==================== BANK ACCOUNT CRUD OPERATIONS ====================

// POST - Create bank account (Admin only)
router.post(
  "/bank-accounts",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountData = validateBankAccountCreate(req.body);

    const branch = await Branch.findByPk(accountData.branch_id);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const existingAccount = await BankAccount.findOne({
      where: {
        branch_id: accountData.branch_id,
        account_number: accountData.account_number,
      },
    });

    if (existingAccount) {
      throw new AppError(
        `Account number ${accountData.account_number} already exists for this branch`,
        400,
      );
    }

    const newAccount = await BankAccount.create({
      branch_id: accountData.branch_id,
      bank_name: accountData.bank_name,
      account_number: accountData.account_number,
      account_name: accountData.account_name,
      account_type: accountData.account_type!,
      currency: accountData.currency || "ETB",
      is_active: accountData.is_active || false,
      notes: accountData.notes || null,
    });

    const response =
      await BankAccountService.formatBankAccountResponse(newAccount);
    res.status(201).json(response);
  }),
);

// GET - Get all bank accounts
router.get(
  "/bank-accounts",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const isActive =
      req.query.is_active === "true"
        ? true
        : req.query.is_active === "false"
          ? false
          : undefined;

    const where: any = {};

    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        return res.json([]);
      }
      where.branch_id = currentUser.branch_id;
    } else if (branchId) {
      where.branch_id = branchId;
    }

    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    const accounts = await BankAccount.findAll({
      where,
      order: [
        ["bank_name", "ASC"],
        ["account_number", "ASC"],
      ],
    });

    const result = [];
    for (const account of accounts) {
      result.push(await BankAccountService.formatBankAccountResponse(account));
    }

    res.json(result);
  }),
);

// GET - Get single bank account
router.get(
  "/bank-accounts/:accountId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = parseInt(req.params.accountId as string);
    const currentUser = req.user!;

    const account = await BankAccount.findByPk(accountId);
    if (!account) {
      throw new AppError("Bank account not found", 404);
    }

    if (
      currentUser.role === "salesman" &&
      account.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Not authorized to view this bank account", 403);
    }

    const response =
      await BankAccountService.formatBankAccountResponse(account);
    res.json(response);
  }),
);

// PUT - Update bank account (Admin only)
router.put(
  "/bank-accounts/:accountId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = parseInt(req.params.accountId as string);
    const updateData = validateBankAccountUpdate(req.body);

    const account = await BankAccount.findByPk(accountId);
    if (!account) {
      throw new AppError("Bank account not found", 404);
    }

    await BankAccountService.updateBankAccount(account, updateData);

    const response =
      await BankAccountService.formatBankAccountResponse(account);
    res.json(response);
  }),
);

// DELETE - Deactivate bank account (Admin only)
router.delete(
  "/bank-accounts/:accountId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = parseInt(req.params.accountId as string);

    const account = await BankAccount.findByPk(accountId);
    if (!account) {
      throw new AppError("Bank account not found", 404);
    }

    account.is_active = false;
    account.updated_at = new Date();
    await account.save();

    res.status(204).send();
  }),
);

// PATCH - Activate bank account (Admin only)
router.patch(
  "/bank-accounts/:accountId/activate",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = parseInt(req.params.accountId as string);

    const account = await BankAccount.findByPk(accountId);
    if (!account) {
      throw new AppError("Bank account not found", 404);
    }

    account.is_active = true;
    account.updated_at = new Date();
    await account.save();

    const response =
      await BankAccountService.formatBankAccountResponse(account);
    res.json(response);
  }),
);

// ==================== REFUND OPERATIONS ====================

// POST - Create refund
router.post(
  "/refunds",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const refundData = validateRefundCreate(req.body);

    const { refund, items, originalSale } = await RefundService.createRefund(
      database.sequelize!,
      refundData,
      currentUser.id,
    );

    const response = await RefundService.formatRefundResponse(
      database.sequelize!,
      refund,
      items,
      originalSale,
      currentUser,
    );

    res.status(201).json(response);
  }),
);

// GET - Get all refunds
router.get(
  "/refunds",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const saleId = req.query.sale_id
      ? parseInt(req.query.sale_id as string)
      : undefined;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const where: any = {};

    if (currentUser.role === "salesman") {
      if (!currentUser.branch_id) {
        return res.json([]);
      }
      where.branch_id = currentUser.branch_id;
    } else if (branchId) {
      where.branch_id = branchId;
    }

    if (saleId) where.original_sale_id = saleId;
    if (startDate) where.created_at = { [Op.gte]: startDate };
    if (endDate) where.created_at = { ...where.created_at, [Op.lte]: endDate };

    const refunds = await Refund.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
    });

    const result = [];
    for (const refund of refunds) {
      const originalSale = await Sale.findByPk(refund.original_sale_id);
      const user = await User.findByPk(refund.user_id);
      const refundItems = await RefundItem.findAll({
        where: { refund_id: refund.id },
      });

      const items = [];
      for (const item of refundItems) {
        const product = await Product.findByPk(item.product_id);
        items.push({
          id: item.id,
          sale_item_id: item.sale_item_id,
          product_id: item.product_id,
          product_name: product?.name || null,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          refund_amount: Number(item.refund_amount),
          reason: item.reason,
        });
      }

      result.push({
        id: refund.id,
        refund_number: refund.refund_number,
        original_sale_id: refund.original_sale_id,
        original_invoice_number: originalSale?.invoice_number,
        branch_id: refund.branch_id,
        user_id: refund.user_id,
        user_name: user?.name,
        customer_name: refund.customer_name,
        refund_amount: Number(refund.refund_amount),
        refund_reason: refund.refund_reason,
        refund_method: refund.refund_method,
        bank_account_id: refund.bank_account_id,
        transaction_reference: refund.transaction_reference,
        status: refund.status,
        created_at: refund.created_at,
        completed_at: refund.completed_at,
        notes: refund.notes,
        items,
      });
    }

    res.json(result);
  }),
);

// GET - Get single refund
router.get(
  "/refunds/:refundId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refundId = parseInt(req.params.refundId as string);
    const currentUser = req.user!;

    const refund = await Refund.findByPk(refundId);
    if (!refund) {
      throw new AppError("Refund not found", 404);
    }

    if (
      currentUser.role === "salesman" &&
      refund.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Not authorized to view this refund", 403);
    }

    const originalSale = await Sale.findByPk(refund.original_sale_id);
    const user = await User.findByPk(refund.user_id);
    const refundItems = await RefundItem.findAll({
      where: { refund_id: refund.id },
    });

    const items = [];
    for (const item of refundItems) {
      const product = await Product.findByPk(item.product_id);
      items.push({
        id: item.id,
        sale_item_id: item.sale_item_id,
        product_id: item.product_id,
        product_name: product?.name || null,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        refund_amount: Number(item.refund_amount),
        reason: item.reason,
      });
    }

    res.json({
      id: refund.id,
      refund_number: refund.refund_number,
      original_sale_id: refund.original_sale_id,
      original_invoice_number: originalSale?.invoice_number,
      branch_id: refund.branch_id,
      user_id: refund.user_id,
      user_name: user?.name,
      customer_name: refund.customer_name,
      refund_amount: Number(refund.refund_amount),
      refund_reason: refund.refund_reason,
      refund_method: refund.refund_method,
      bank_account_id: refund.bank_account_id,
      transaction_reference: refund.transaction_reference,
      status: refund.status,
      created_at: refund.created_at,
      completed_at: refund.completed_at,
      notes: refund.notes,
      items,
    });
  }),
);

// ==================== SALE OPERATIONS ====================

// POST - Create sale
router.post(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const saleData = validateSaleCreate(req.body);

    let branchId = saleData.branch_id || currentUser.branch_id;

    if (!branchId) {
      throw new AppError("Branch ID is required", 400);
    }

    if (currentUser.role === "salesman" && currentUser.branch_id !== branchId) {
      throw new AppError("Not authorized to sell from this branch", 403);
    }

    const { sale, items, branch } = await SaleService.createSale(
      database.sequelize!,
      saleData,
      branchId,
      currentUser.id,
    );

    const response = await SaleService.formatSaleResponse(
      database.sequelize!,
      sale,
      items,
      branch,
      currentUser,
    );

    // Send email notification to admins
    try {
      const adminEmails = await AuthService.getAllAdminEmails(
        database.sequelize!,
      );

      if (adminEmails.length > 0 && settings.EMAIL_ENABLED) {
        const saleDataForEmail = {
          sale_id: sale.id,
          customer_name: sale.customer_name || "Walk-in Customer",
          total_amount: Number(sale.total_amount),
          item_count: items.length,
          salesman_name: currentUser.name,
          branch_name: branch.name,
          created_at: sale.created_at,
        };

        await EmailService.sendSaleNotification(adminEmails, saleDataForEmail);
        logger.info(
          `Sale notification email sent to ${adminEmails.length} admins`,
        );
      }
    } catch (emailError) {
      logger.error(`Failed to send sale notification email: ${emailError}`);
    }

    res.status(201).json(response);
  }),
);

// GET - Get all sales
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;
    const paymentMethod = req.query.payment_method as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const where: any = {};

    if (currentUser.role === "salesman") {
      if (branchId && branchId !== currentUser.branch_id) {
        throw new AppError(
          "Not authorized to view sales from other branches",
          403,
        );
      }
      where.branch_id = currentUser.branch_id;
    } else if (branchId) {
      where.branch_id = branchId;
    }

    if (startDate) where.created_at = { [Op.gte]: startDate };
    if (endDate) where.created_at = { ...where.created_at, [Op.lte]: endDate };
    if (paymentMethod) where.payment_method = paymentMethod;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { invoice_number: { [Op.like]: `%${search}%` } },
        { customer_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const sales = await Sale.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
    });

    const result = [];
    for (const sale of sales) {
      const items = await SaleItem.findAll({
        where: { sale_id: sale.id },
        include: [{ model: Product, as: "product" }],
      });

      const branch = await Branch.findByPk(sale.branch_id);
      const user = await User.findByPk(sale.user_id);

      result.push({
        id: sale.id,
        invoice_number: sale.invoice_number,
        branch_id: sale.branch_id,
        branch_name: branch?.name,
        user_id: sale.user_id,
        user_name: user?.name,
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
        transaction_reference: sale.transaction_reference,
        status: sale.status,
        refund_amount: Number(sale.refund_amount),
        refund_status: sale.refund_status,
        created_at: sale.created_at,
        updated_at: sale.updated_at,
        notes: sale.notes,
        items: items.map((item) => ({
          id: item.id,
          sale_id: item.sale_id,
          product_id: item.product_id,
          product_name: (item as any).product?.name,
          product_sku: (item as any).product?.sku,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount_amount: Number(item.discount_amount),
          line_total: Number(item.line_total),
        })),
      });
    }

    res.json(result);
  }),
);

// GET - Get single sale
router.get(
  "/:saleId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const saleId = parseInt(req.params.saleId as string);
    const currentUser = req.user!;

    const sale = await Sale.findByPk(saleId);
    if (!sale) {
      throw new AppError("Sale not found", 404);
    }

    if (
      currentUser.role === "salesman" &&
      sale.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Not authorized to view this sale", 403);
    }

    const items = await SaleItem.findAll({
      where: { sale_id: sale.id },
      include: [{ model: Product, as: "product" }],
    });

    const branch = await Branch.findByPk(sale.branch_id);
    const user = await User.findByPk(sale.user_id);

    res.json({
      id: sale.id,
      invoice_number: sale.invoice_number,
      branch_id: sale.branch_id,
      branch_name: branch?.name,
      user_id: sale.user_id,
      user_name: user?.name,
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
      transaction_reference: sale.transaction_reference,
      status: sale.status,
      refund_amount: Number(sale.refund_amount),
      refund_status: sale.refund_status,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
      notes: sale.notes,
      items: items.map((item) => ({
        id: item.id,
        sale_id: item.sale_id,
        product_id: item.product_id,
        product_name: (item as any).product?.name,
        product_sku: (item as any).product?.sku,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_amount: Number(item.discount_amount),
        line_total: Number(item.line_total),
      })),
    });
  }),
);

// PUT - Update sale
router.put(
  "/:saleId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const saleId = parseInt(req.params.saleId as string);
    const currentUser = req.user!;
    const updateData = validateSaleUpdate(req.body);

    const sale = await Sale.findByPk(saleId);
    if (!sale) {
      throw new AppError("Sale not found", 404);
    }

    if (
      currentUser.role === "salesman" &&
      sale.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Not authorized to update this sale", 403);
    }

    const allowedFields = [
      "customer_name",
      "customer_phone",
      "customer_email",
      "notes",
    ];
    for (const field of allowedFields) {
      if (updateData[field as keyof typeof updateData] !== undefined) {
        (sale as any)[field] = updateData[field as keyof typeof updateData];
      }
    }

    await sale.save();

    // Return updated sale
    const items = await SaleItem.findAll({
      where: { sale_id: sale.id },
      include: [{ model: Product, as: "product" }],
    });

    const branch = await Branch.findByPk(sale.branch_id);
    const user = await User.findByPk(sale.user_id);

    res.json({
      id: sale.id,
      invoice_number: sale.invoice_number,
      branch_id: sale.branch_id,
      branch_name: branch?.name,
      user_id: sale.user_id,
      user_name: user?.name,
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
      transaction_reference: sale.transaction_reference,
      status: sale.status,
      refund_amount: Number(sale.refund_amount),
      refund_status: sale.refund_status,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
      notes: sale.notes,
      items: items.map((item) => ({
        id: item.id,
        sale_id: item.sale_id,
        product_id: item.product_id,
        product_name: (item as any).product?.name,
        product_sku: (item as any).product?.sku,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_amount: Number(item.discount_amount),
        line_total: Number(item.line_total),
      })),
    });
  }),
);

// GET - Sales summary by payment method
router.get(
  "/summary/payment-methods",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;

    const where: any = {};

    if (currentUser.role === "salesman") {
      where.branch_id = currentUser.branch_id;
    } else if (branchId) {
      where.branch_id = branchId;
    }

    if (startDate) where.created_at = { [Op.gte]: startDate };
    if (endDate) where.created_at = { ...where.created_at, [Op.lte]: endDate };

    const sales = await Sale.findAll({ where });

    const summary: Record<
      string,
      { count: number; total_amount: number; total_tax: number }
    > = {};
    for (const sale of sales) {
      const method = sale.payment_method;
      if (!summary[method]) {
        summary[method] = { count: 0, total_amount: 0, total_tax: 0 };
      }
      summary[method].count++;
      summary[method].total_amount += Number(sale.total_amount);
      summary[method].total_tax += Number(sale.tax_amount);
    }

    res.json(summary);
  }),
);

// GET - Sales summary by status
router.get(
  "/summary/status",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const startDate = req.query.start_date
      ? new Date(req.query.start_date as string)
      : undefined;
    const endDate = req.query.end_date
      ? new Date(req.query.end_date as string)
      : undefined;

    const where: any = {};

    if (currentUser.role === "salesman") {
      where.branch_id = currentUser.branch_id;
    } else if (branchId) {
      where.branch_id = branchId;
    }

    if (startDate) where.created_at = { [Op.gte]: startDate };
    if (endDate) where.created_at = { ...where.created_at, [Op.lte]: endDate };

    const sales = await Sale.findAll({ where });

    const summary: Record<
      string,
      { count: number; total_amount: number; total_refund: number }
    > = {};
    for (const sale of sales) {
      const status = sale.status;
      if (!summary[status]) {
        summary[status] = { count: 0, total_amount: 0, total_refund: 0 };
      }
      summary[status].count++;
      summary[status].total_amount += Number(sale.total_amount);
      summary[status].total_refund += Number(sale.refund_amount);
    }

    res.json(summary);
  }),
);

export default router;
