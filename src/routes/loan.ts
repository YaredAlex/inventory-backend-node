import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { database } from "../database.js";
import { Loan } from "../models/loan.js";
import { LoanPayment } from "../models/loan_payment.js";
import { LoanItem } from "../models/loan_item.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { LoanService } from "../services/loan_service.js";
import {
  LoanCreate,
  LoanUpdate,
  LoanPaymentCreate,
  LoanSettleRequest,
  LoanStatus,
  LoanPaymentMethod,
} from "../schemas/loan.js";
import {
  requireAuth,
  requireAdmin,
  requirePrivileged,
} from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All loan routes require authentication
router.use(requireAuth);

// ==================== LOAN CRUD OPERATIONS ====================

// POST - Create loan (Privileged users only)
router.post(
  ["/", ""],
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const loanData: LoanCreate = req.body;

    if (!currentUser.branch_id) {
      throw new AppError("User not assigned to a branch", 400);
    }

    // Validate required fields
    if (!loanData.customer_name || loanData.customer_name.length < 2) {
      throw new AppError("Customer name must be at least 2 characters", 400);
    }
    if (!loanData.items || loanData.items.length === 0) {
      throw new AppError("At least one item is required", 400);
    }
    if (!loanData.due_date) {
      throw new AppError("Due date is required", 400);
    }

    const loan = await LoanService.createLoan(
      database.sequelize!,
      currentUser.branch_id,
      currentUser.id,
      loanData,
      currentUser.role === "admin",
    );

    const response = await LoanService.formatLoanResponse(
      database.sequelize!,
      loan,
    );
    res.status(201).json(response);
  }),
);

// POST - Approve loan (Admin only)
router.post(
  "/:loanId/approve",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const currentUser = req.user!;

    const loan = await LoanService.approveLoan(
      database.sequelize!,
      loanId,
      currentUser.id,
    );

    const approver = await User.findByPk(loan.approved_by);

    res.json({
      message: "Loan approved successfully",
      loan_id: loan.id,
      loan_number: loan.loan_number,
      approved_by: approver?.name || "System",
      approved_at: loan.approved_at,
    });
  }),
);

// GET - Get all loans
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const { customer_name, status, skip = 0, limit = 100 } = req.query;

    const where: any = {};

    // Regular sales users only see their branch's loans
    if (!currentUser.isPrivileged || !currentUser.isPrivileged()) {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }
      where.branch_id = currentUser.branch_id;
    }

    if (customer_name) {
      where.customer_name = { [Op.like]: `%${customer_name}%` };
    }
    if (status) {
      where.status = status;
    }

    const loans = await Loan.findAll({
      where,
      order: [["created_at", "DESC"]],
      offset: Number(skip),
      limit: Number(limit),
    });

    const result = [];
    for (const loan of loans) {
      result.push(
        await LoanService.formatLoanResponse(database.sequelize!, loan),
      );
    }

    res.json(result);
  }),
);

// GET by ID - Get single loan
router.get(
  "/:loanId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const currentUser = req.user!;

    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    // Check permission for non-privileged users
    if (!currentUser.isPrivileged || !currentUser.isPrivileged()) {
      if (!currentUser.branch_id) {
        throw new AppError("User not assigned to a branch", 400);
      }
      if (loan.branch_id !== currentUser.branch_id) {
        throw new AppError("Not authorized to view this loan", 403);
      }
    }

    const response = await LoanService.formatLoanResponse(
      database.sequelize!,
      loan,
    );
    res.json(response);
  }),
);

// PUT - Update loan (Admin only)
router.put(
  "/:loanId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const loanUpdate: LoanUpdate = req.body;

    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    if (loanUpdate.due_date) {
      loan.due_date = loanUpdate.due_date;
    }
    if (loanUpdate.interest_rate !== undefined) {
      const oldInterestAmount = Number(loan.interest_amount);
      const principal = Number(loan.total_amount) - oldInterestAmount;
      loan.interest_rate = loanUpdate.interest_rate;
      loan.interest_amount = principal * (loanUpdate.interest_rate / 100);
      loan.total_amount = principal + loan.interest_amount;
      loan.remaining_amount = loan.total_amount - Number(loan.paid_amount);
    }
    if (loanUpdate.status) {
      loan.status = loanUpdate.status;
    }
    if (loanUpdate.notes !== undefined) {
      loan.notes = loanUpdate.notes;
    }

    loan.updated_at = new Date();
    await loan.save();

    const response = await LoanService.formatLoanResponse(
      database.sequelize!,
      loan,
    );
    res.json(response);
  }),
);

// DELETE - Delete loan (Admin only)
router.delete(
  "/:loanId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const currentUser = req.user!;

    await LoanService.deleteLoan(database.sequelize!, loanId, currentUser.id);
    res.status(204).send();
  }),
);

// ==================== LOAN PAYMENT OPERATIONS ====================

// POST - Add payment (Privileged users only)
router.post(
  "/:loanId/payments",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const currentUser = req.user!;
    const paymentData: LoanPaymentCreate = req.body;

    if (!paymentData.amount || paymentData.amount <= 0) {
      throw new AppError("Payment amount must be greater than 0", 400);
    }
    if (!paymentData.payment_method) {
      throw new AppError("Payment method is required", 400);
    }

    const payment = await LoanService.addLoanPayment(
      database.sequelize!,
      loanId,
      currentUser.id,
      paymentData,
    );

    const recorder = await User.findByPk(payment.recorded_by);

    res.json({
      id: payment.id,
      payment_number: payment.payment_number,
      payment_date: payment.payment_date,
      amount: Number(payment.amount),
      payment_method: payment.payment_method,
      reference_number: payment.reference_number,
      notes: payment.notes,
      recorded_by: recorder?.name || "System",
      sale_id: payment.sale_id,
      created_at: payment.created_at,
    });
  }),
);

// POST - Settle loan (Privileged users only)
router.post(
  "/:loanId/settle",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const currentUser = req.user!;
    const settleData: LoanSettleRequest = req.body;

    const result = await LoanService.settleLoan(
      database.sequelize!,
      loanId,
      currentUser.id,
      settleData,
    );

    res.json(result);
  }),
);

// GET - Get loan payments
router.get(
  "/:loanId/payments",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const loanId = parseInt(req.params.loanId as string);
    const currentUser = req.user!;

    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    // Check permission
    if (!currentUser.isPrivileged || !currentUser.isPrivileged()) {
      if (loan.branch_id !== currentUser.branch_id) {
        throw new AppError("Not authorized to view these payments", 403);
      }
    }

    const payments = await LoanPayment.findAll({
      where: { loan_id: loanId },
      order: [["payment_date", "DESC"]],
    });

    const result = [];
    for (const payment of payments) {
      const recorder = await User.findByPk(payment.recorded_by);
      result.push({
        id: payment.id,
        payment_number: payment.payment_number,
        payment_date: payment.payment_date,
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        reference_number: payment.reference_number,
        notes: payment.notes,
        recorded_by: recorder?.name || "System",
        sale_id: payment.sale_id,
        created_at: payment.created_at,
      });
    }

    res.json(result);
  }),
);

export default router;
