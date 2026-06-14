// services/wallet.service.ts
import { Op } from "sequelize";
import { Decimal } from "decimal.js";
import { Wallet } from "../models/wallet.js";
import { WalletTransaction } from "../models/wallet_transaction.js";
import { WalletSummary } from "../models/wallet_summary.js";
import { BankAccount } from "../models/bank_account.js";
import { BankTransaction } from "../models/bank_transaction.js";
import {
  WalletPurpose,
  WalletTransactionMethod,
  WalletTransactionStatus,
  WalletTransactionType,
  validateWalletCreate,
  validateWalletUpdate,
  validateWalletTransactionCreate,
} from "../schemas/wallet.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "./logger.js";

// ==================== HELPER FUNCTIONS ====================

export async function generateWalletNumber(
  branchId: number,
  walletType: string,
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  const prefix = walletType.substring(0, 3).toUpperCase();
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

  return `${prefix}-${branchId}-${timestamp}`;
}

export async function generateTransactionNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

  return `TXN-${timestamp}-${random}`;
}

// ==================== WALLET MANAGEMENT ====================

export interface GetOrCreateWalletOptions {
  walletName?: string;
  walletPurpose?: WalletPurpose;
  createdBy?: number;
  currency?: string;
}

export async function getOrCreateWallet(
  branchId: number,
  walletType: string,
  options: GetOrCreateWalletOptions = {},
): Promise<Wallet> {
  const {
    walletName,
    walletPurpose = WalletPurpose.OTHER,
    createdBy = 1,
    currency = "ETB",
  } = options;

  let wallet = await Wallet.findOne({
    where: {
      branch_id: branchId,
      wallet_type: walletType,
    },
  });

  if (!wallet) {
    const walletNumber = await generateWalletNumber(branchId, walletType);

    wallet = await Wallet.create({
      wallet_number: walletNumber,
      wallet_name:
        walletName ||
        `${walletType.charAt(0).toUpperCase() + walletType.slice(1)} Wallet`,
      branch_id: branchId,
      wallet_type: walletType,
      wallet_purpose: walletPurpose,
      balance: 0,
      currency: currency,
      is_active: true,
      created_by: createdBy,
    });

    logger.info(
      `Created new wallet: ${wallet.wallet_number} (${walletType}) for branch ${branchId}`,
    );
  }

  return wallet;
}

export async function createWallet(data: any): Promise<Wallet> {
  const validatedData = validateWalletCreate(data);

  const walletNumber = await generateWalletNumber(
    validatedData.branch_id,
    validatedData.wallet_type,
  );

  const wallet = await Wallet.create({
    wallet_number: walletNumber,
    wallet_name: validatedData.wallet_name,
    branch_id: validatedData.branch_id,
    wallet_type: validatedData.wallet_type,
    wallet_purpose: validatedData.wallet_purpose || "",
    balance: 0,
    currency: validatedData.currency || "",
    is_active: true,
    description: validatedData.description || null,
    created_by: validatedData.created_by || 1,
  });

  logger.info(
    `Created new wallet: ${wallet.wallet_number} for branch ${validatedData.branch_id}`,
  );

  return wallet;
}

export async function updateWallet(
  walletId: number,
  data: any,
): Promise<Wallet> {
  const validatedData = validateWalletUpdate(data);

  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  await wallet.update(validatedData);
  wallet.updated_at = new Date();
  await wallet.save();

  logger.info(`Updated wallet: ${wallet.wallet_number}`);

  return wallet;
}

// ==================== WALLET TRANSACTION PROCESSING ====================

export interface ProcessWalletTransactionOptions {
  transactionMethod?: WalletTransactionMethod;
  referenceType?: string;
  referenceId?: number;
  referenceNumber?: string;
  bankReference?: string;
  fromWalletId?: number;
  toWalletId?: number;
  userId?: number;
}

export async function processWalletTransaction(
  walletId: number,
  transactionType: WalletTransactionType,
  amount: number,
  description: string,
  options: ProcessWalletTransactionOptions = {},
): Promise<WalletTransaction> {
  const {
    transactionMethod = WalletTransactionMethod.CASH,
    referenceType = null,
    referenceId = null,
    referenceNumber = null,
    bankReference = null,
    fromWalletId = null,
    toWalletId = null,
    userId = null,
  } = options;

  const amountDecimal = new Decimal(amount);

  // Get wallet
  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  if (!wallet.is_active) {
    throw new AppError("Wallet is inactive", 400);
  }

  // Check daily limit if applicable
  const debitTransactions = [
    WalletTransactionType.WITHDRAWAL,
    WalletTransactionType.PURCHASE,
    WalletTransactionType.RESTOCK,
  ];

  if (wallet.daily_limit && debitTransactions.includes(transactionType)) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dailyTotalResult = await WalletTransaction.sum("amount", {
      where: {
        wallet_id: walletId,
        transaction_type: {
          [Op.in]: debitTransactions,
        },
        created_at: {
          [Op.gte]: todayStart,
        },
        status: WalletTransactionStatus.COMPLETED,
      },
    });

    const dailyTotal = new Decimal(dailyTotalResult || 0);
    const dailyLimit = new Decimal(wallet.daily_limit.toString());

    if (dailyTotal.plus(amountDecimal).greaterThan(dailyLimit)) {
      throw new AppError(
        `Daily limit exceeded. Limit: ${wallet.daily_limit}, Used today: ${dailyTotal.toFixed(2)}`,
        400,
      );
    }
  }

  // Check transaction limit if applicable
  if (wallet.transaction_limit) {
    const transactionLimit = new Decimal(wallet.transaction_limit.toString());
    if (amountDecimal.greaterThan(transactionLimit)) {
      throw new AppError(
        `Transaction amount exceeds limit. Max per transaction: ${wallet.transaction_limit}`,
        400,
      );
    }
  }

  // Calculate new balance
  const balanceBefore = new Decimal(wallet.balance.toString());
  let balanceAfter: Decimal;

  // Special handling for transfer transactions
  if (transactionType === WalletTransactionType.TRANSFER) {
    // If this is a transfer TO this wallet, it's a credit
    if (toWalletId === walletId) {
      balanceAfter = balanceBefore.plus(amountDecimal);
    }
    // If this is a transfer FROM this wallet, it's a debit
    else if (fromWalletId === walletId) {
      if (balanceBefore.lessThan(amountDecimal)) {
        throw new AppError(
          `Insufficient funds in wallet. Available: ${balanceBefore.toFixed(2)}, Required: ${amountDecimal.toFixed(2)}`,
          400,
        );
      }
      balanceAfter = balanceBefore.minus(amountDecimal);
    }
    // Try to infer from context
    else if (toWalletId !== null && fromWalletId === null) {
      // This wallet is sending money -> debit
      if (balanceBefore.lessThan(amountDecimal)) {
        throw new AppError(
          `Insufficient funds in wallet. Available: ${balanceBefore.toFixed(2)}, Required: ${amountDecimal.toFixed(2)}`,
          400,
        );
      }
      balanceAfter = balanceBefore.minus(amountDecimal);
    } else if (fromWalletId !== null && toWalletId === null) {
      // This wallet is receiving money -> credit
      balanceAfter = balanceBefore.plus(amountDecimal);
    } else {
      throw new AppError("Invalid transfer transaction", 400);
    }
  } else if (debitTransactions.includes(transactionType)) {
    if (balanceBefore.lessThan(amountDecimal)) {
      throw new AppError(
        `Insufficient funds in wallet. Available: ${balanceBefore.toFixed(2)}, Required: ${amountDecimal.toFixed(2)}`,
        400,
      );
    }
    balanceAfter = balanceBefore.minus(amountDecimal);
  } else {
    // Credit transactions (deposit, refund, adjustment)
    balanceAfter = balanceBefore.plus(amountDecimal);
  }

  // Check max balance if applicable (only for credit transactions)
  if (
    !debitTransactions.includes(transactionType) &&
    transactionType !== WalletTransactionType.TRANSFER
  ) {
    if (wallet.max_balance) {
      const maxBalance = new Decimal(wallet.max_balance.toString());
      if (balanceAfter.greaterThan(maxBalance)) {
        throw new AppError(
          `Max balance would be exceeded. Limit: ${wallet.max_balance}`,
          400,
        );
      }
    }
  }

  // Create transaction record
  const transactionNumber = await generateTransactionNumber();

  const walletTransaction = await WalletTransaction.create({
    transaction_number: transactionNumber,
    wallet_id: walletId,
    transaction_type: transactionType,
    transaction_method: transactionMethod,
    amount: amountDecimal.toNumber(),
    balance_before: balanceBefore.toNumber(),
    balance_after: balanceAfter.toNumber(),
    status: WalletTransactionStatus.COMPLETED,
    description: description,
    reference_type: referenceType,
    reference_id: referenceId,
    reference_number: referenceNumber,
    bank_reference: bankReference,
    from_wallet_id: fromWalletId,
    to_wallet_id: toWalletId,
    created_by: userId!,
  });

  // Update wallet balance
  wallet.balance = balanceAfter.toNumber();
  wallet.updated_at = new Date();
  await wallet.save();

  // If linked to bank account, update bank balance and create bank transaction
  if (
    wallet.bank_account_id &&
    [WalletTransactionType.DEPOSIT, WalletTransactionType.WITHDRAWAL].includes(
      transactionType,
    )
  ) {
    const bankAccount = await BankAccount.findByPk(wallet.bank_account_id);

    if (bankAccount) {
      const currentBalance = new Decimal(
        bankAccount.current_balance.toString(),
      );
      if (transactionType === WalletTransactionType.DEPOSIT) {
        bankAccount.current_balance = currentBalance
          .plus(amountDecimal)
          .toNumber();
      } else {
        bankAccount.current_balance = currentBalance
          .minus(amountDecimal)
          .toNumber();
      }
      await bankAccount.save();

      // Create bank transaction record
      await BankTransaction.create({
        bank_account_id: bankAccount.id,
        transaction_date: new Date(),
        transaction_type:
          transactionType === WalletTransactionType.DEPOSIT
            ? "credit"
            : "debit",
        amount: amountDecimal.toNumber(),
        description: description,
        reference: walletTransaction.transaction_number,
        wallet_transaction_id: walletTransaction.id,
      });
    }
  }

  // Check minimum balance alert
  if (wallet.min_balance) {
    const minBalance = new Decimal(wallet.min_balance.toString());
    if (balanceAfter.lessThan(minBalance)) {
      logger.warn(
        `Wallet ${wallet.wallet_number} balance (${balanceAfter.toFixed(2)}) is below minimum (${wallet.min_balance})`,
      );
    }
  }

  logger.info(
    `Wallet transaction processed: ${transactionNumber} - Type: ${transactionType} - Amount: ${amountDecimal.toFixed(2)} - Wallet: ${wallet.wallet_number}`,
  );

  return walletTransaction;
}

// ==================== WALLET SUMMARY GENERATION ====================

export async function generateWalletSummary(
  walletId: number,
  summaryDate: Date,
): Promise<WalletSummary> {
  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  // Get start and end of day
  const startOfDay = new Date(summaryDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(summaryDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get transactions for the day
  const transactions = await WalletTransaction.findAll({
    where: {
      wallet_id: walletId,
      created_at: {
        [Op.between]: [startOfDay, endOfDay],
      },
      status: WalletTransactionStatus.COMPLETED,
    },
  });

  // Calculate totals using Decimal for precision
  let totalDeposits = new Decimal(0);
  let totalWithdrawals = new Decimal(0);
  let totalTransfersIn = new Decimal(0);
  let totalTransfersOut = new Decimal(0);
  let totalPurchases = new Decimal(0);
  let totalRestocks = new Decimal(0);
  let totalRefunds = new Decimal(0);

  const amounts: Decimal[] = [];

  for (const tx of transactions) {
    const amount = new Decimal(tx.amount.toString());
    amounts.push(amount);

    switch (tx.transaction_type) {
      case WalletTransactionType.DEPOSIT:
        totalDeposits = totalDeposits.plus(amount);
        break;
      case WalletTransactionType.WITHDRAWAL:
        totalWithdrawals = totalWithdrawals.plus(amount);
        break;
      case WalletTransactionType.TRANSFER:
        if (tx.to_wallet_id === walletId) {
          totalTransfersIn = totalTransfersIn.plus(amount);
        } else {
          totalTransfersOut = totalTransfersOut.plus(amount);
        }
        break;
      case WalletTransactionType.PURCHASE:
        totalPurchases = totalPurchases.plus(amount);
        break;
      case WalletTransactionType.RESTOCK:
        totalRestocks = totalRestocks.plus(amount);
        break;
      case WalletTransactionType.REFUND:
        totalRefunds = totalRefunds.plus(amount);
        break;
    }
  }

  // Calculate opening balance (current balance minus today's changes)
  const totalIncome = totalDeposits.plus(totalTransfersIn).plus(totalRefunds);
  const totalExpenses = totalWithdrawals
    .plus(totalTransfersOut)
    .plus(totalPurchases)
    .plus(totalRestocks);
  const currentBalance = new Decimal(wallet.balance.toString());
  const openingBalance = currentBalance.minus(totalIncome.minus(totalExpenses));

  // Calculate statistics
  const transactionCount = transactions.length;
  let averageAmount = new Decimal(0);
  let highestAmount = new Decimal(0);
  let lowestAmount = new Decimal(0);

  if (amounts.length > 0) {
    let sum = new Decimal(0);
    for (const amount of amounts) {
      sum = sum.plus(amount);
      if (highestAmount.lessThan(amount)) highestAmount = amount;
      if (lowestAmount.equals(0) || lowestAmount.greaterThan(amount))
        lowestAmount = amount;
    }
    averageAmount = sum.dividedBy(amounts.length);
  }

  // Find or create summary
  let summary = await WalletSummary.findOne({
    where: {
      wallet_id: walletId,
      summary_date: summaryDate,
    },
  });

  if (summary) {
    // Update existing summary
    summary.opening_balance = openingBalance.toNumber();
    summary.total_deposits = totalDeposits.toNumber();
    summary.total_transfers_in = totalTransfersIn.toNumber();
    summary.total_withdrawals = totalWithdrawals.toNumber();
    summary.total_transfers_out = totalTransfersOut.toNumber();
    summary.total_purchases = totalPurchases.toNumber();
    summary.total_restocks = totalRestocks.toNumber();
    summary.total_refunds = totalRefunds.toNumber();
    summary.closing_balance = currentBalance.toNumber();
    summary.transaction_count = transactionCount;
    summary.average_transaction_amount = averageAmount.toNumber();
    summary.highest_transaction = highestAmount.toNumber();
    summary.lowest_transaction = lowestAmount.toNumber();
    summary.updated_at = new Date();
    await summary.save();
  } else {
    // Create new summary
    summary = await WalletSummary.create({
      wallet_id: walletId,
      branch_id: wallet.branch_id,
      summary_date: summaryDate,
      opening_balance: openingBalance.toNumber(),
      total_deposits: totalDeposits.toNumber(),
      total_transfers_in: totalTransfersIn.toNumber(),
      total_withdrawals: totalWithdrawals.toNumber(),
      total_transfers_out: totalTransfersOut.toNumber(),
      total_purchases: totalPurchases.toNumber(),
      total_restocks: totalRestocks.toNumber(),
      total_refunds: totalRefunds.toNumber(),
      closing_balance: currentBalance.toNumber(),
      transaction_count: transactionCount,
      average_transaction_amount: averageAmount.toNumber(),
      highest_transaction: highestAmount.toNumber(),
      lowest_transaction: lowestAmount.toNumber(),
    });
  }

  return summary;
}

// ==================== ADDITIONAL WALLET FUNCTIONS ====================

export async function getWalletBalance(walletId: number): Promise<{
  current_balance: number;
  pending_balance: number;
  available_balance: number;
}> {
  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  const pendingTransactions = await WalletTransaction.findAll({
    where: {
      wallet_id: walletId,
      status: WalletTransactionStatus.PENDING,
    },
  });

  let pendingBalance = new Decimal(0);
  const debitTransactions = [
    WalletTransactionType.WITHDRAWAL,
    WalletTransactionType.PURCHASE,
    WalletTransactionType.RESTOCK,
  ];

  for (const tx of pendingTransactions) {
    const amount = new Decimal(tx.amount.toString());
    if (
      debitTransactions.includes(tx.transaction_type as WalletTransactionType)
    ) {
      pendingBalance = pendingBalance.minus(amount);
    } else {
      pendingBalance = pendingBalance.plus(amount);
    }
  }

  const currentBalance = new Decimal(wallet.balance.toString());
  const availableBalance = currentBalance.plus(pendingBalance);

  return {
    current_balance: currentBalance.toNumber(),
    pending_balance: pendingBalance.toNumber(),
    available_balance: availableBalance.toNumber(),
  };
}

export async function getWalletTransactions(
  walletId: number,
  options: {
    fromDate?: Date;
    toDate?: Date;
    transactionType?: WalletTransactionType;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const { fromDate, toDate, transactionType, limit = 50, offset = 0 } = options;

  const where: any = { wallet_id: walletId };

  if (fromDate) {
    where.created_at = { [Op.gte]: fromDate };
  }
  if (toDate) {
    where.created_at = { ...where.created_at, [Op.lte]: toDate };
  }
  if (transactionType) {
    where.transaction_type = transactionType;
  }

  const { count, rows } = await WalletTransaction.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });

  return {
    transactions: rows,
    total: count,
  };
}

export async function transferBetweenWallets(
  fromWalletId: number,
  toWalletId: number,
  amount: number,
  description: string,
  userId: number,
): Promise<{
  fromTransaction: WalletTransaction;
  toTransaction: WalletTransaction;
}> {
  if (fromWalletId === toWalletId) {
    throw new AppError("Cannot transfer to the same wallet", 400);
  }

  const transaction = await Wallet.sequelize?.transaction();

  try {
    const fromTransaction = await processWalletTransaction(
      fromWalletId,
      WalletTransactionType.TRANSFER,
      amount,
      description,
      {
        userId,
        toWalletId,
        referenceType: "wallet_transfer",
      },
    );

    const toTransaction = await processWalletTransaction(
      toWalletId,
      WalletTransactionType.TRANSFER,
      amount,
      description,
      {
        userId,
        fromWalletId,
        referenceType: "wallet_transfer",
      },
    );

    await transaction?.commit();

    return { fromTransaction, toTransaction };
  } catch (error) {
    await transaction?.rollback();
    throw error;
  }
}

export async function getWalletById(walletId: number): Promise<Wallet> {
  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }
  return wallet;
}

export async function getAllWallets(branchId?: number): Promise<Wallet[]> {
  const where: any = {};
  if (branchId) {
    where.branch_id = branchId;
  }

  const wallets = await Wallet.findAll({
    where,
    order: [
      ["wallet_type", "ASC"],
      ["wallet_name", "ASC"],
    ],
  });

  return wallets;
}
