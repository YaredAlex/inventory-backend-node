import { Sequelize, Op } from "sequelize";
import { ApprovalStatus, Loan } from "../models/loan.js";
import { LoanItem } from "../models/loan_item.js";
import { LoanPayment } from "../models/loan_payment.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { MovementType, StockMovement } from "../models/stock_movement.js";
import { User } from "../models/user.js";
import { AppError } from "../middleware/error_handle.js";
import {
  generateLoanNumber,
  generatePaymentNumber,
  LoanStatus,
  LoanPaymentMethod,
} from "../schemas/loan.js";
import logger from "../services/logger.js";

export interface LoanItemInfo {
  product: Product;
  stock: Stock;
  data: any;
  line_total: number;
}

export class LoanService {
  static calculateInterest(
    totalAmount: number,
    interestRate: number,
  ): { interestAmount: number; totalWithInterest: number } {
    const interestAmount = totalAmount * (interestRate / 100);
    const totalWithInterest = totalAmount + interestAmount;
    return { interestAmount, totalWithInterest };
  }

  static async validateStockAndCalculateTotal(
    sequelize: Sequelize,
    branchId: number,
    items: any[],
  ): Promise<{ totalAmount: number; loanItemsData: LoanItemInfo[] }> {
    let totalAmount = 0;
    const loanItemsData: LoanItemInfo[] = [];

    for (const itemData of items) {
      const product = await Product.findByPk(itemData.product_id);
      if (!product) {
        throw new AppError(`Product ${itemData.product_id} not found`, 404);
      }

      const stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: itemData.product_id,
        },
      });

      if (!stock || Number(stock.quantity) < itemData.quantity) {
        const available = stock ? Number(stock.quantity) : 0;
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${available}, Requested: ${itemData.quantity}`,
          400,
        );
      }

      const lineTotal = itemData.quantity * itemData.unit_price;
      totalAmount += lineTotal;

      loanItemsData.push({
        product,
        stock,
        data: itemData,
        line_total: lineTotal,
      });
    }

    return { totalAmount, loanItemsData };
  }

  static async createLoan(
    sequelize: Sequelize,
    branchId: number,
    userId: number,
    loanData: any,
    isAdmin: boolean,
  ): Promise<any> {
    // Validate stock and calculate total
    const { totalAmount, loanItemsData } =
      await this.validateStockAndCalculateTotal(
        sequelize,
        branchId,
        loanData.items,
      );

    // Calculate interest
    const interestRate = loanData.interest_rate || 0;
    const { interestAmount, totalWithInterest } = this.calculateInterest(
      totalAmount,
      interestRate,
    );

    // Determine if loan requires approval
    const requiresApproval = !isAdmin;
    const approvalStatus = requiresApproval
      ? ApprovalStatus.PENDING
      : ApprovalStatus.APPROVED;

    // Create loan
    const loan = await Loan.create({
      loan_number: generateLoanNumber(),
      branch_id: branchId,
      customer_name: loanData.customer_name,
      customer_phone: loanData.customer_phone || null,
      customer_email: loanData.customer_email || null,
      loan_date: new Date(),
      due_date: loanData.due_date,
      total_amount: totalWithInterest,
      paid_amount: 0,
      remaining_amount: totalWithInterest,
      interest_rate: interestRate,
      interest_amount: interestAmount,
      notes: loanData.notes || null,
      created_by: userId,
      status: LoanStatus.ACTIVE,
      requires_approval: requiresApproval,
      approval_status: approvalStatus,
      approved_by: isAdmin ? userId : null,
      approved_at: isAdmin ? new Date() : null,
    });

    // Add loan items and update stock
    for (const itemInfo of loanItemsData) {
      await LoanItem.create({
        loan_id: loan.id,
        product_id: itemInfo.data.product_id,
        quantity: itemInfo.data.quantity,
        unit_price: itemInfo.data.unit_price,
        line_total: itemInfo.line_total,
      });

      // Deduct stock
      const stock = itemInfo.stock;
      stock.quantity = Number(stock.quantity) - itemInfo.data.quantity;
      await stock.save();

      // Record stock movement
      await StockMovement.create({
        branch_id: branchId,
        product_id: itemInfo.data.product_id,
        user_id: userId,
        change_qty: -itemInfo.data.quantity,
        movement_type: MovementType.LOAN,
        reference_id: loan.id,
        notes: `Loan #${loan.loan_number} - ${loanData.customer_name} - Deducted ${itemInfo.data.quantity} units`,
      });
    }

    return loan;
  }

  static async approveLoan(
    sequelize: Sequelize,
    loanId: number,
    userId: number,
  ): Promise<any> {
    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    if (loan.approval_status === "approved") {
      throw new AppError("Loan already approved", 400);
    }

    loan.approval_status = ApprovalStatus.APPROVED;
    loan.approved_by = userId;
    loan.approved_at = new Date();
    await loan.save();

    return loan;
  }

  static async addLoanPayment(
    sequelize: Sequelize,
    loanId: number,
    userId: number,
    paymentData: any,
  ): Promise<any> {
    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    if (loan.status === LoanStatus.SETTLED) {
      throw new AppError("Loan already settled", 400);
    }

    const remainingAmount = Number(loan.remaining_amount);
    if (paymentData.amount > remainingAmount) {
      throw new AppError(
        `Payment amount exceeds remaining balance of ${remainingAmount}`,
        400,
      );
    }

    // Create payment record
    const payment = await LoanPayment.create({
      loan_id: loanId,
      payment_number: generatePaymentNumber(),
      payment_date: new Date(),
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number || null,
      notes: paymentData.notes || null,
      recorded_by: userId,
      sale_id: paymentData.sale_id || null,
    });

    // Update loan
    const newPaidAmount = Number(loan.paid_amount) + paymentData.amount;
    const newRemainingAmount = Number(loan.total_amount) - newPaidAmount;

    loan.paid_amount = newPaidAmount;
    loan.remaining_amount = newRemainingAmount;

    if (newRemainingAmount === 0) {
      loan.status = LoanStatus.SETTLED;
    } else {
      loan.status = LoanStatus.PARTIALLY_PAID;
    }

    loan.updated_at = new Date();
    await loan.save();

    return payment;
  }

  static async settleLoan(
    sequelize: Sequelize,
    loanId: number,
    userId: number,
    settleData: any,
  ): Promise<{ paymentId: number; message: string }> {
    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    if (loan.status === LoanStatus.SETTLED) {
      throw new AppError("Loan already settled", 400);
    }

    const remainingAmount = Number(loan.remaining_amount);
    if (settleData.amount < remainingAmount) {
      throw new AppError(
        `Amount must be at least ${remainingAmount} to settle`,
        400,
      );
    }

    // Create payment for remaining amount
    const payment = await LoanPayment.create({
      loan_id: loanId,
      payment_number: generatePaymentNumber(),
      payment_date: new Date(),
      amount: remainingAmount,
      payment_method: settleData.payment_method,
      reference_number: settleData.reference_number || null,
      notes: settleData.notes || null,
      recorded_by: userId,
      sale_id: null,
    });

    // Update loan
    loan.paid_amount = loan.total_amount;
    loan.remaining_amount = 0;
    loan.status = LoanStatus.SETTLED;
    loan.updated_at = new Date();
    await loan.save();

    return { paymentId: payment.id, message: "Loan settled successfully" };
  }

  static async deleteLoan(
    sequelize: Sequelize,
    loanId: number,
    userId: number,
  ): Promise<void> {
    const loan = await Loan.findByPk(loanId, {
      include: [{ model: LoanItem, as: "items" }],
    });

    if (!loan) {
      throw new AppError("Loan not found", 404);
    }

    // Only allow deletion of loans with no payments or settled status
    if (Number(loan.paid_amount) > 0 && loan.status !== LoanStatus.SETTLED) {
      throw new AppError("Cannot delete loan with existing payments", 400);
    }

    // Restore stock for items
    const items = (loan as any).items || [];
    for (const item of items) {
      const stock = await Stock.findOne({
        where: {
          branch_id: loan.branch_id,
          product_id: item.product_id,
        },
      });

      if (stock) {
        stock.quantity = Number(stock.quantity) + Number(item.quantity);
        await stock.save();
      }

      // Record stock movement for restoration
      await StockMovement.create({
        branch_id: loan.branch_id,
        product_id: item.product_id,
        user_id: userId,
        change_qty: Number(item.quantity),
        movement_type: MovementType.RETURN,
        reference_id: loan.id,
        notes: `Loan #${loan.loan_number} deleted - Stock restored`,
      });
    }

    await loan.destroy();
  }

  static async formatLoanResponse(
    sequelize: Sequelize,
    loan: Loan,
  ): Promise<any> {
    const creator = await User.findByPk(loan.created_by);
    const creatorName = creator?.name || "System";

    let approverName = null;
    if (loan.approved_by) {
      const approver = await User.findByPk(loan.approved_by);
      approverName = approver?.name || "System";
    }

    const items = await LoanItem.findAll({
      where: { loan_id: loan.id },
    });

    const itemsResponse = [];
    for (const item of items) {
      const product = await Product.findByPk(item.product_id);
      itemsResponse.push({
        id: item.id,
        product_id: item.product_id,
        product_name: product?.name || null,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      });
    }

    const payments = await LoanPayment.findAll({
      where: { loan_id: loan.id },
    });

    const paymentsResponse = [];
    for (const payment of payments) {
      const recorder = await User.findByPk(payment.recorded_by);
      paymentsResponse.push({
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

    return {
      id: loan.id,
      loan_number: loan.loan_number,
      branch_id: loan.branch_id,
      customer_name: loan.customer_name,
      customer_phone: loan.customer_phone,
      customer_email: loan.customer_email,
      loan_date: loan.loan_date,
      due_date: loan.due_date,
      total_amount: Number(loan.total_amount),
      paid_amount: Number(loan.paid_amount),
      remaining_amount: Number(loan.remaining_amount),
      interest_rate: Number(loan.interest_rate),
      interest_amount: Number(loan.interest_amount),
      status: loan.status,
      notes: loan.notes,
      items: itemsResponse,
      payments: paymentsResponse,
      created_by: creatorName,
      approved_by: approverName,
      approved_at: loan.approved_at,
      created_at: loan.created_at,
      updated_at: loan.updated_at,
    };
  }
}
