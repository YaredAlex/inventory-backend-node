// routes/wallet.routes.ts
import { Router, Request, Response } from "express";
import { Op } from "sequelize";
import { Decimal } from "decimal.js";
import { Branch } from "../models/branch.js";
import { Wallet } from "../models/wallet.js";
import { WalletTransaction } from "../models/wallet_transaction.js";
import { WalletSummary } from "../models/wallet_summary.js";
import { BankAccount } from "../models/bank_account.js";
import { BankTransaction } from "../models/bank_transaction.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import {
  WalletType,
  WalletPurpose,
  WalletTransactionType,
  WalletTransactionMethod,
  WalletTransactionStatus,
  WalletResponse,
  WalletTransactionResponse,
  WalletSummaryResponse,
  WalletBalanceResponse,
  BranchWalletSummaryResponse,
  WalletPerformanceReport,
  validateWalletCreate,
  validateWalletUpdate,
  validateWalletDeposit,
  validateWalletWithdrawal,
  validateWalletTransfer,
} from "../schemas/wallet.js";
import {
  requireAdmin,
  requirePrivileged,
  requireAuth,
} from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// ==================== HELPER FUNCTIONS ====================

function generateWalletNumber(branchId: number, walletType: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "");
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `W${walletType.substring(0, 3).toUpperCase()}-${branchId}-${timestamp}-${randomSuffix}`;
}

function generateTransactionNumber(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "");
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${randomSuffix}`;
}

// Import wallet service functions
import {
  processWalletTransaction as processWalletTransactionService,
  generateWalletSummary as generateWalletSummaryService,
  getOrCreateWallet as getOrCreateWalletService,
  getWalletById,
  getAllWallets,
  getWalletBalance,
  getWalletTransactions,
  transferBetweenWallets,
} from "../services/wallet_service.js";
import { BankAccountResponse } from "../schemas/bank_account.js";

// ==================== WALLET CRUD ENDPOINTS ====================

router.post(
  "/create",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const walletData = validateWalletCreate(req.body);
    const currentUser = req.user;

    const branch = await Branch.findByPk(walletData.branch_id);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Check bank account if provided
    if (walletData.bank_account_id) {
      const bankAccount = await BankAccount.findOne({
        where: {
          id: walletData.bank_account_id,
          branch_id: walletData.branch_id,
        },
      });
      if (!bankAccount) {
        throw new AppError(
          "Bank account not found or doesn't belong to branch",
          404,
        );
      }
    }

    const initialBalance = walletData.initial_balance || 0;
    const walletNumber = generateWalletNumber(
      walletData.branch_id,
      walletData.wallet_type,
    );

    const wallet = await Wallet.create({
      wallet_number: walletNumber,
      wallet_name: walletData.wallet_name,
      branch_id: walletData.branch_id,
      wallet_type: walletData.wallet_type,
      wallet_purpose: walletData.wallet_purpose || WalletPurpose.OTHER,
      balance: initialBalance,
      currency: walletData.currency || "ETB",
      bank_account_id: walletData.bank_account_id || null,
      is_active: true,
      requires_approval: walletData.requires_approval || false,
      max_balance: walletData.max_balance || null,
      min_balance: walletData.min_balance || null,
      daily_limit: walletData.daily_limit || null,
      transaction_limit: walletData.transaction_limit || null,
      description: walletData.description || null,
      created_by: currentUser.id,
    });

    // Only create initial deposit transaction if initial_balance > 0
    if (initialBalance > 0) {
      await processWalletTransactionService(
        wallet.id,
        WalletTransactionType.DEPOSIT,
        initialBalance,
        "Initial wallet deposit",
        {
          userId: currentUser.id,
          transactionMethod: WalletTransactionMethod.BANK_TRANSFER,
        },
      );
      await wallet.reload();
    }

    // Create initial summary
    await generateWalletSummaryService(wallet.id, new Date());

    const response: WalletResponse = {
      id: wallet.id,
      wallet_number: wallet.wallet_number,
      wallet_name: wallet.wallet_name,
      branch_id: wallet.branch_id,
      branch_name: branch.name,
      wallet_type: wallet.wallet_type as WalletType,
      wallet_purpose: wallet.wallet_purpose as WalletPurpose,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      bank_account_id: wallet.bank_account_id,
      is_active: wallet.is_active,
      requires_approval: wallet.requires_approval,
      max_balance: wallet.max_balance ? Number(wallet.max_balance) : null,
      min_balance: wallet.min_balance ? Number(wallet.min_balance) : null,
      daily_limit: wallet.daily_limit ? Number(wallet.daily_limit) : null,
      transaction_limit: wallet.transaction_limit
        ? Number(wallet.transaction_limit)
        : null,
      description: wallet.description,
      created_by: wallet.created_by,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at,
    };

    res.status(201).json(response);
  }),
);

router.get(
  "/branch/:branchId",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);
    const { include_inactive } = req.query;
    const currentUser = req.user;

    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    if (currentUser.role === "salesman" && currentUser.branch_id !== branchId) {
      throw new AppError("Access denied", 403);
    }

    const where: any = { branch_id: branchId };
    if (!include_inactive) {
      where.is_active = true;
    }

    const wallets = await Wallet.findAll({ where });

    const result: WalletResponse[] = wallets.map((wallet: any) => ({
      id: wallet.id,
      wallet_number: wallet.wallet_number,
      wallet_name: wallet.wallet_name,
      branch_id: wallet.branch_id,
      branch_name: branch.name,
      wallet_type: wallet.wallet_type as WalletType,
      wallet_purpose: wallet.wallet_purpose as WalletPurpose,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      bank_account_id: wallet.bank_account_id,
      is_active: wallet.is_active,
      requires_approval: wallet.requires_approval,
      max_balance: wallet.max_balance ? Number(wallet.max_balance) : null,
      min_balance: wallet.min_balance ? Number(wallet.min_balance) : null,
      daily_limit: wallet.daily_limit ? Number(wallet.daily_limit) : null,
      transaction_limit: wallet.transaction_limit
        ? Number(wallet.transaction_limit)
        : null,
      description: wallet.description,
      created_by: wallet.created_by,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at,
    }));

    res.json(result);
  }),
);

router.get(
  "/balances",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const currentUser = req.user;

    if (currentUser.role === "salesman") {
      branchId = currentUser.branch_id;
    } else if (!branchId && currentUser.role === "admin") {
      branchId = currentUser.branch_id || 1;
    }

    if (!branchId) {
      throw new AppError("Branch ID required", 400);
    }

    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const wallets = await Wallet.findAll({
      where: {
        branch_id: branchId,
        is_active: true,
      },
    });

    const walletBalances: WalletBalanceResponse[] = [];
    let totalBalance = 0;

    for (const wallet of wallets) {
      let bankAccountName = null;
      if (wallet.bank_account_id) {
        const bankAccount = await BankAccount.findByPk(wallet.bank_account_id);
        bankAccountName = bankAccount?.account_name || null;
      }

      walletBalances.push({
        wallet_id: wallet.id,
        wallet_name: wallet.wallet_name,
        wallet_type: wallet.wallet_type,
        balance: Number(wallet.balance),
        currency: wallet.currency,
        bank_account_name: bankAccountName,
        last_transaction_at: null,
      });
      totalBalance += Number(wallet.balance);
    }

    const response: BranchWalletSummaryResponse = {
      branch_id: branch.id,
      branch_name: branch.name,
      wallets: walletBalances,
      total_balance: totalBalance,
    };

    res.json(response);
  }),
);

router.put(
  "/:walletId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const walletId = parseInt(req.params.walletId as string);
    const walletUpdate = validateWalletUpdate(req.body);
    const currentUser = req.user;

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    await wallet.update(walletUpdate);
    wallet.updated_at = new Date();
    await wallet.save();

    const branch = await Branch.findByPk(wallet.branch_id);

    const response: WalletResponse = {
      id: wallet.id,
      wallet_number: wallet.wallet_number,
      wallet_name: wallet.wallet_name,
      branch_id: wallet.branch_id,
      branch_name: branch?.name || null,
      wallet_type: wallet.wallet_type as WalletType,
      wallet_purpose: wallet.wallet_purpose as WalletPurpose,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      bank_account_id: wallet.bank_account_id,
      is_active: wallet.is_active,
      requires_approval: wallet.requires_approval,
      max_balance: wallet.max_balance ? Number(wallet.max_balance) : null,
      min_balance: wallet.min_balance ? Number(wallet.min_balance) : null,
      daily_limit: wallet.daily_limit ? Number(wallet.daily_limit) : null,
      transaction_limit: wallet.transaction_limit
        ? Number(wallet.transaction_limit)
        : null,
      description: wallet.description,
      created_by: wallet.created_by,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at,
    };

    res.json(response);
  }),
);

// ==================== WALLET TRANSACTION ENDPOINTS ====================

router.post(
  "/deposit",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const depositData = validateWalletDeposit(req.body);
    const currentUser = req.user;

    const wallet = await Wallet.findByPk(depositData.wallet_id);
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    const transaction = await processWalletTransactionService(
      depositData.wallet_id,
      WalletTransactionType.DEPOSIT,
      depositData.amount,
      depositData.description || "Cash deposit",
      {
        userId: currentUser.id,
        transactionMethod:
          depositData.transaction_method || WalletTransactionMethod.CASH,
        referenceType: depositData.reference_type || "",
        referenceId: depositData.reference_id!,
        referenceNumber: depositData.reference_number!,
        bankReference: depositData.bank_reference!,
      },
    );

    await generateWalletSummaryService(wallet.id, new Date());

    const response: WalletTransactionResponse = {
      id: transaction.id,
      transaction_number: transaction.transaction_number,
      wallet_id: transaction.wallet_id,
      wallet_name: wallet.wallet_name,
      transaction_type: transaction.transaction_type as WalletTransactionType,
      transaction_method:
        transaction.transaction_method as WalletTransactionMethod,
      amount: Number(transaction.amount),
      balance_before: Number(transaction.balance_before),
      balance_after: Number(transaction.balance_after),
      status: transaction.status as WalletTransactionStatus,
      approval_status: transaction.approval_status,
      description: transaction.description || "",
      reference_type: transaction.reference_type,
      reference_id: transaction.reference_id,
      reference_number: transaction.reference_number,
      bank_reference: transaction.bank_reference,
      from_wallet_id: transaction.from_wallet_id,
      to_wallet_id: transaction.to_wallet_id,
      created_by: transaction.created_by,
      created_at: transaction.created_at,
      created_by_name: currentUser.name,
      approved_by: null,
      approved_at: null,
    };

    res.status(201).json(response);
  }),
);

router.post(
  "/withdraw",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const withdrawalData = validateWalletWithdrawal(req.body);
    const currentUser = req.user;

    const wallet = await Wallet.findByPk(withdrawalData.wallet_id);
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    const transaction = await processWalletTransactionService(
      withdrawalData.wallet_id,
      WalletTransactionType.WITHDRAWAL,
      withdrawalData.amount,
      withdrawalData.description || "Cash withdrawal",
      {
        userId: currentUser.id,
        transactionMethod:
          withdrawalData.transaction_method || WalletTransactionMethod.CASH,
        referenceType: withdrawalData.reference_type || "",
        referenceId: withdrawalData.reference_id!,
        referenceNumber: withdrawalData.reference_number!,
        bankReference: withdrawalData.bank_reference!,
      },
    );

    await generateWalletSummaryService(wallet.id, new Date());

    const response: WalletTransactionResponse = {
      id: transaction.id,
      transaction_number: transaction.transaction_number,
      wallet_id: transaction.wallet_id,
      wallet_name: wallet.wallet_name,
      transaction_type: transaction.transaction_type as WalletTransactionType,
      transaction_method:
        transaction.transaction_method as WalletTransactionMethod,
      amount: Number(transaction.amount),
      balance_before: Number(transaction.balance_before),
      balance_after: Number(transaction.balance_after),
      status: transaction.status as WalletTransactionStatus,
      approval_status: transaction.approval_status,
      description: transaction.description || "",
      reference_type: transaction.reference_type,
      reference_id: transaction.reference_id,
      reference_number: transaction.reference_number,
      bank_reference: transaction.bank_reference,
      from_wallet_id: transaction.from_wallet_id,
      to_wallet_id: transaction.to_wallet_id,
      created_by: transaction.created_by,
      created_at: transaction.created_at,
      created_by_name: currentUser.name,
      approved_by: null,
      approved_at: null,
    };

    res.status(201).json(response);
  }),
);

router.post(
  "/transfer",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const transferData = validateWalletTransfer(req.body);
    const currentUser = req.user;

    const fromWallet = await Wallet.findByPk(transferData.from_wallet_id);
    const toWallet = await Wallet.findByPk(transferData.to_wallet_id);

    if (!fromWallet) {
      throw new AppError("Source wallet not found", 404);
    }
    if (!toWallet) {
      throw new AppError("Destination wallet not found", 404);
    }

    const result = await transferBetweenWallets(
      transferData.from_wallet_id,
      transferData.to_wallet_id,
      transferData.amount,
      transferData.description || "",
      currentUser.id,
    );

    await generateWalletSummaryService(fromWallet.id, new Date());
    await generateWalletSummaryService(toWallet.id, new Date());

    const responses: WalletTransactionResponse[] = [
      {
        id: result.fromTransaction.id,
        transaction_number: result.fromTransaction.transaction_number,
        wallet_id: result.fromTransaction.wallet_id,
        wallet_name: fromWallet.wallet_name,
        transaction_type: "transfer_out" as WalletTransactionType,
        transaction_method: result.fromTransaction
          .transaction_method as WalletTransactionMethod,
        amount: Number(result.fromTransaction.amount),
        balance_before: Number(result.fromTransaction.balance_before),
        balance_after: Number(result.fromTransaction.balance_after),
        status: result.fromTransaction.status as WalletTransactionStatus,
        approval_status: result.fromTransaction.approval_status,
        description: result.fromTransaction.description || "",
        reference_type: result.fromTransaction.reference_type,
        reference_id: result.fromTransaction.reference_id,
        reference_number: result.fromTransaction.reference_number,
        bank_reference: result.fromTransaction.bank_reference,
        from_wallet_id: result.fromTransaction.from_wallet_id,
        to_wallet_id: result.fromTransaction.to_wallet_id,
        created_by: result.fromTransaction.created_by,
        created_at: result.fromTransaction.created_at,
        created_by_name: currentUser.name,
        approved_by: null,
        approved_at: null,
      },
      {
        id: result.toTransaction.id,
        transaction_number: result.toTransaction.transaction_number,
        wallet_id: result.toTransaction.wallet_id,
        wallet_name: toWallet.wallet_name,
        transaction_type: "transfer_in" as WalletTransactionType,
        transaction_method: result.toTransaction
          .transaction_method as WalletTransactionMethod,
        amount: Number(result.toTransaction.amount),
        balance_before: Number(result.toTransaction.balance_before),
        balance_after: Number(result.toTransaction.balance_after),
        status: result.toTransaction.status as WalletTransactionStatus,
        approval_status: result.toTransaction.approval_status,
        description: result.toTransaction.description || "",
        reference_type: result.toTransaction.reference_type,
        reference_id: result.toTransaction.reference_id,
        reference_number: result.toTransaction.reference_number,
        bank_reference: result.toTransaction.bank_reference,
        from_wallet_id: result.toTransaction.from_wallet_id,
        to_wallet_id: result.toTransaction.to_wallet_id,
        created_by: result.toTransaction.created_by,
        created_at: result.toTransaction.created_at,
        created_by_name: currentUser.name,
        approved_by: null,
        approved_at: null,
      },
    ];

    res.status(201).json(responses);
  }),
);

router.get(
  "/transactions",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const walletId = parseInt(req.query.wallet_id as string);
    const transactionType = req.query.transaction_type as string;
    const transactionMethod = req.query.transaction_method as string;
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const currentUser = req.user;

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    if (
      currentUser.role === "salesman" &&
      wallet.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Access denied", 403);
    }

    const where: any = { wallet_id: walletId };

    if (transactionType) {
      where.transaction_type = transactionType;
    }
    if (transactionMethod) {
      where.transaction_method = transactionMethod;
    }
    if (fromDate) {
      where.created_at = { [Op.gte]: fromDate };
    }
    if (toDate) {
      where.created_at = { ...where.created_at, [Op.lte]: toDate };
    }

    const { rows: transactions, count } =
      await WalletTransaction.findAndCountAll({
        where,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

    const result: WalletTransactionResponse[] = [];
    for (const txn of transactions) {
      let displayType = txn.transaction_type;
      if (txn.transaction_type === "transfer") {
        if (txn.to_wallet_id === walletId) {
          displayType = "transfer_in";
        } else {
          displayType = "transfer_out";
        }
      }

      const creator = txn.created_by
        ? await User.findByPk(txn.created_by)
        : null;

      result.push({
        id: txn.id,
        transaction_number: txn.transaction_number,
        wallet_id: txn.wallet_id,
        wallet_name: wallet.wallet_name,
        transaction_type: displayType as WalletTransactionType,
        transaction_method: txn.transaction_method as WalletTransactionMethod,
        amount: Number(txn.amount),
        balance_before: Number(txn.balance_before),
        balance_after: Number(txn.balance_after),
        status: txn.status as WalletTransactionStatus,
        approval_status: txn.approval_status,
        description: txn.description || "",
        reference_type: txn.reference_type,
        reference_id: txn.reference_id,
        reference_number: txn.reference_number,
        bank_reference: txn.bank_reference,
        from_wallet_id: txn.from_wallet_id,
        to_wallet_id: txn.to_wallet_id,
        created_by: txn.created_by,
        created_at: txn.created_at,
        created_by_name: creator?.name || null,
        approved_by: null,
        approved_at: null,
      });
    }

    res.json({
      transactions: result,
      total: count,
      limit,
      offset,
    });
  }),
);

// ==================== WALLET SUMMARY ENDPOINTS ====================

router.get(
  "/summary/:walletId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const walletId = parseInt(req.params.walletId as string);
    let summaryDate = req.query.summary_date
      ? new Date(req.query.summary_date as string)
      : new Date();

    const summary = await generateWalletSummaryService(walletId, summaryDate);
    const wallet = await Wallet.findByPk(walletId);
    const branch = wallet ? await Branch.findByPk(wallet.branch_id) : null;

    const response: WalletSummaryResponse = {
      id: summary.id,
      wallet_id: summary.wallet_id,
      wallet_name: wallet?.wallet_name || null,
      branch_id: summary.branch_id,
      branch_name: branch?.name || null,
      summary_date: summary.summary_date,
      opening_balance: Number(summary.opening_balance),
      total_deposits: Number(summary.total_deposits),
      total_transfers_in: Number(summary.total_transfers_in),
      total_income:
        Number(summary.total_deposits) +
        Number(summary.total_transfers_in) +
        Number(summary.total_refunds),
      total_withdrawals: Number(summary.total_withdrawals),
      total_transfers_out: Number(summary.total_transfers_out),
      total_purchases: Number(summary.total_purchases),
      total_restocks: Number(summary.total_restocks),
      total_refunds: Number(summary.total_refunds),
      total_expenses:
        Number(summary.total_withdrawals) +
        Number(summary.total_transfers_out) +
        Number(summary.total_purchases) +
        Number(summary.total_restocks),
      closing_balance: Number(summary.closing_balance),
      transaction_count: summary.transaction_count,
      average_transaction_amount: Number(summary.average_transaction_amount),
      highest_transaction: Number(summary.highest_transaction),
      lowest_transaction: Number(summary.lowest_transaction),
      bank_balance_at_date: summary.bank_balance_at_date
        ? Number(summary.bank_balance_at_date)
        : null,
      is_reconciled: summary.is_reconciled,
      reconciled_at: summary.reconciled_at,
      created_at: summary.created_at,
      updated_at: summary.updated_at,
      notes: summary.notes,
    };

    res.json(response);
  }),
);

router.get(
  "/summary/range/:walletId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const walletId = parseInt(req.params.walletId as string);
    const fromDate = new Date(req.query.from_date as string);
    const toDate = new Date(req.query.to_date as string);

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    const branch = await Branch.findByPk(wallet.branch_id);
    const summaries: WalletSummaryResponse[] = [];

    let currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
      const summary = await generateWalletSummaryService(walletId, currentDate);

      summaries.push({
        id: summary.id,
        wallet_id: summary.wallet_id,
        wallet_name: wallet.wallet_name,
        branch_id: summary.branch_id,
        branch_name: branch?.name || null,
        summary_date: summary.summary_date,
        opening_balance: Number(summary.opening_balance),
        total_deposits: Number(summary.total_deposits),
        total_transfers_in: Number(summary.total_transfers_in),
        total_income:
          Number(summary.total_deposits) +
          Number(summary.total_transfers_in) +
          Number(summary.total_refunds),
        total_withdrawals: Number(summary.total_withdrawals),
        total_transfers_out: Number(summary.total_transfers_out),
        total_purchases: Number(summary.total_purchases),
        total_restocks: Number(summary.total_restocks),
        total_refunds: Number(summary.total_refunds),
        total_expenses:
          Number(summary.total_withdrawals) +
          Number(summary.total_transfers_out) +
          Number(summary.total_purchases) +
          Number(summary.total_restocks),
        closing_balance: Number(summary.closing_balance),
        transaction_count: summary.transaction_count,
        average_transaction_amount: Number(summary.average_transaction_amount),
        highest_transaction: Number(summary.highest_transaction),
        lowest_transaction: Number(summary.lowest_transaction),
        bank_balance_at_date: summary.bank_balance_at_date
          ? Number(summary.bank_balance_at_date)
          : null,
        is_reconciled: summary.is_reconciled,
        reconciled_at: summary.reconciled_at,
        created_at: summary.created_at,
        updated_at: summary.updated_at,
        notes: summary.notes,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(summaries);
  }),
);

// ==================== BANK ACCOUNT ENDPOINTS ====================

router.post(
  "/bank-account/create",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountData = req.body;
    const currentUser = req.user;

    const branch = await Branch.findByPk(accountData.branch_id);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const existing = await BankAccount.findOne({
      where: {
        branch_id: accountData.branch_id,
        account_number: accountData.account_number,
      },
    });

    if (existing) {
      throw new AppError(
        "Bank account number already exists for this branch",
        400,
      );
    }

    const bankAccount = await BankAccount.create({
      ...accountData,
      current_balance: 0,
      created_by: currentUser.id,
    });

    const response: BankAccountResponse = {
      id: bankAccount.id,
      branch_id: bankAccount.branch_id,
      bank_name: bankAccount.bank_name,
      branch_name: bankAccount.branch_name,
      account_number: bankAccount.account_number,
      account_name: bankAccount.account_name,
      account_type: bankAccount.account_type,
      iban: bankAccount.iban,
      swift_code: bankAccount.swift_code,
      currency: bankAccount.currency,
      current_balance: Number(bankAccount.current_balance),
      is_active: bankAccount.is_active,
      is_primary: bankAccount.is_primary,
      last_reconciled_at: bankAccount.last_reconciled_at,
      last_reconciled_balance: bankAccount.last_reconciled_balance
        ? Number(bankAccount.last_reconciled_balance)
        : null,
      notes: bankAccount.notes,
      created_by: bankAccount.created_by,
      created_at: bankAccount.created_at,
      updated_at: bankAccount.updated_at,
    };

    res.status(201).json(response);
  }),
);

router.get(
  "/bank-accounts/:branchId",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = parseInt(req.params.branchId as string);

    const accounts = await BankAccount.findAll({
      where: {
        branch_id: branchId,
        is_active: true,
      },
    });

    const result: BankAccountResponse[] = accounts.map((account: any) => ({
      id: account.id,
      branch_id: account.branch_id,
      bank_name: account.bank_name,
      branch_name: account.branch_name,
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      iban: account.iban,
      swift_code: account.swift_code,
      currency: account.currency,
      current_balance: Number(account.current_balance),
      is_active: account.is_active,
      is_primary: account.is_primary,
      last_reconciled_at: account.last_reconciled_at,
      last_reconciled_balance: account.last_reconciled_balance
        ? Number(account.last_reconciled_balance)
        : null,
      notes: account.notes,
      created_by: account.created_by,
      created_at: account.created_at,
      updated_at: account.updated_at,
    }));

    res.json(result);
  }),
);

// ==================== BUSINESS OPERATION ENDPOINTS ====================

router.post(
  "/process-restock/:productId",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.productId as string);
    const quantity = parseFloat(req.query.quantity as string);
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const walletId = req.query.wallet_id
      ? parseInt(req.query.wallet_id as string)
      : undefined;
    const currentUser = req.user;

    if (isNaN(quantity) || quantity <= 0) {
      throw new AppError("Quantity must be greater than 0", 400);
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (!branchId) {
      branchId = currentUser.branch_id;
    }

    if (!branchId) {
      throw new AppError("Branch ID required", 400);
    }

    const totalCost = quantity * Number(product.cost);

    let wallet;
    if (walletId) {
      wallet = await Wallet.findOne({
        where: {
          id: walletId,
          branch_id: branchId,
          is_active: true,
        },
      });
      if (!wallet) {
        throw new AppError("Wallet not found", 404);
      }
    } else {
      wallet = await getOrCreateWalletService(branchId, "regular");
    }

    const transaction = await processWalletTransactionService(
      wallet.id,
      WalletTransactionType.RESTOCK,
      totalCost,
      `Restocked ${quantity} units of ${product.name} (SKU: ${product.sku})`,
      {
        userId: currentUser.id,
        referenceType: "restock",
        referenceId: productId,
      },
    );

    await generateWalletSummaryService(wallet.id, new Date());

    res.json({
      message: "Restock processed successfully",
      transaction: transaction.transaction_number,
      amount_deducted: totalCost,
      wallet_id: wallet.id,
      wallet_name: wallet.wallet_name,
      wallet_balance: Number(wallet.balance),
    });
  }),
);

// ==================== REPORTING ENDPOINTS ====================

router.get(
  "/performance-report",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const walletId = parseInt(req.query.wallet_id as string);
    const fromDate = new Date(req.query.from_date as string);
    const toDate = new Date(req.query.to_date as string);

    const wallet = await Wallet.findByPk(walletId);
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    const summaries = await WalletSummary.findAll({
      where: {
        wallet_id: walletId,
        summary_date: {
          [Op.between]: [fromDate, toDate],
        },
      },
      order: [["summary_date", "ASC"]],
    });

    const transactions = await WalletTransaction.findAll({
      where: {
        wallet_id: walletId,
        created_at: {
          [Op.between]: [fromDate, toDate],
        },
        status: WalletTransactionStatus.COMPLETED,
      },
      order: [["created_at", "ASC"]],
    });

    const openingBalance =
      summaries.length > 0
        ? Number(summaries[0]?.opening_balance)
        : Number(wallet.balance);
    const closingBalance =
      summaries.length > 0
        ? Number(summaries[summaries.length - 1]?.closing_balance)
        : Number(wallet.balance);

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalTransfersIn = 0;
    let totalTransfersOut = 0;
    let totalPurchases = 0;
    let totalRestocks = 0;
    let totalRefunds = 0;

    for (const s of summaries) {
      totalDeposits += Number(s.total_deposits);
      totalWithdrawals += Number(s.total_withdrawals);
      totalTransfersIn += Number(s.total_transfers_in);
      totalTransfersOut += Number(s.total_transfers_out);
      totalPurchases += Number(s.total_purchases);
      totalRestocks += Number(s.total_restocks);
      totalRefunds += Number(s.total_refunds);
    }

    const dailyBalances = summaries.map((s) => ({
      date: s.summary_date.toISOString().split("T")[0],
      opening_balance: Number(s.opening_balance),
      closing_balance: Number(s.closing_balance),
    }));

    const transactionList: WalletTransactionResponse[] = [];
    for (const t of transactions.slice(0, 100)) {
      let displayType = t.transaction_type;
      if (t.transaction_type === "transfer") {
        if (t.to_wallet_id === walletId) {
          displayType = "transfer_in";
        } else {
          displayType = "transfer_out";
        }
      }

      const creator = t.created_by ? await User.findByPk(t.created_by) : null;

      transactionList.push({
        id: t.id,
        transaction_number: t.transaction_number,
        wallet_id: t.wallet_id,
        wallet_name: wallet.wallet_name,
        transaction_type: displayType as WalletTransactionType,
        transaction_method: t.transaction_method as WalletTransactionMethod,
        amount: Number(t.amount),
        balance_before: Number(t.balance_before),
        balance_after: Number(t.balance_after),
        status: t.status as WalletTransactionStatus,
        approval_status: t.approval_status,
        description: t.description || "",
        reference_type: t.reference_type,
        reference_id: t.reference_id,
        reference_number: t.reference_number,
        bank_reference: t.bank_reference,
        from_wallet_id: t.from_wallet_id,
        to_wallet_id: t.to_wallet_id,
        created_by: t.created_by,
        created_at: t.created_at,
        created_by_name: creator?.name || null,
        approved_by: null,
        approved_at: null,
      });
    }

    const branch = await Branch.findByPk(wallet.branch_id);
    const totalTransactionAmount = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    const averageTransactionSize =
      transactions.length > 0
        ? totalTransactionAmount / transactions.length
        : 0;

    const deposits = transactions
      .filter((t) => t.transaction_type === "deposit")
      .map((t) => Number(t.amount));
    const withdrawals = transactions
      .filter((t) => t.transaction_type === "withdrawal")
      .map((t) => Number(t.amount));

    const response: WalletPerformanceReport = {
      period_start: fromDate,
      period_end: toDate,
      wallet_id: wallet.id,
      wallet_name: wallet.wallet_name,
      branch_id: wallet.branch_id,
      branch_name: branch?.name || null,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      net_change: closingBalance - openingBalance,
      total_deposits: totalDeposits,
      total_withdrawals: totalWithdrawals,
      total_transfers_in: totalTransfersIn,
      total_transfers_out: totalTransfersOut,
      total_purchases: totalPurchases,
      total_restocks: totalRestocks,
      total_refunds: totalRefunds,
      transaction_count: transactions.length,
      average_transaction_size: averageTransactionSize,
      largest_deposit: deposits.length > 0 ? Math.max(...deposits) : 0,
      largest_withdrawal: withdrawals.length > 0 ? Math.max(...withdrawals) : 0,
      daily_balances: dailyBalances,
      transaction_history: transactionList,
    };

    res.json(response);
  }),
);

// ==================== INFO ENDPOINT ====================

router.get(
  "/info",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      module: "Enhanced Wallet Management System",
      version: "3.1.0",
      description: "Multi-wallet system with bank account integration",
      features: [
        "Multiple wallet types per branch (VAT, Regular, Petty Cash, Expense, Custom)",
        "Bank account integration with automatic reconciliation",
        "Real-time balance tracking with transaction history",
        "Transfer between wallets with proper debit/credit accounting",
        "Daily summaries with performance metrics",
        "Transaction limits and approval workflows",
        "Bank statement reconciliation",
        "Wallet performance reporting",
        "Daily, weekly, and monthly summaries",
        "Export capabilities for transactions and summaries",
      ],
      wallet_types: [
        { type: "vat", description: "For VAT-tracked purchases and expenses" },
        { type: "regular", description: "For regular inventory operations" },
        { type: "petty_cash", description: "For small daily expenses" },
        { type: "expense", description: "For operating expenses" },
        { type: "custom", description: "Custom wallet for specific purposes" },
      ],
      transaction_methods: [
        { method: "cash", description: "Cash transactions" },
        { method: "bank_transfer", description: "Bank transfer transactions" },
        { method: "cheque", description: "Cheque payments" },
        { method: "card", description: "Credit/Debit card transactions" },
        { method: "mobile_money", description: "Mobile money transactions" },
        {
          method: "internal_transfer",
          description: "Transfer between wallets",
        },
      ],
    });
  }),
);

export default router;
