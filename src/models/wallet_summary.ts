// models/WalletSummary.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface WalletSummaryAttributes {
  id: number;
  wallet_id: number;
  branch_id: number;
  summary_date: Date;
  opening_balance: number;
  total_deposits: number;
  total_transfers_in: number;
  total_withdrawals: number;
  total_transfers_out: number;
  total_purchases: number;
  total_restocks: number;
  total_refunds: number;
  closing_balance: number;
  transaction_count: number;
  average_transaction_amount: number;
  highest_transaction: number;
  lowest_transaction: number;
  bank_balance_at_date: number | null;
  is_reconciled: boolean;
  reconciled_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// Include all fields that have defaults or can be null in Optional
interface WalletSummaryCreationAttributes extends Optional<
  WalletSummaryAttributes,
  | "id"
  | "created_at"
  | "updated_at"
  | "opening_balance"
  | "total_deposits"
  | "total_transfers_in"
  | "total_withdrawals"
  | "total_transfers_out"
  | "total_purchases"
  | "total_restocks"
  | "total_refunds"
  | "closing_balance"
  | "transaction_count"
  | "average_transaction_amount"
  | "highest_transaction"
  | "lowest_transaction"
  | "bank_balance_at_date"
  | "is_reconciled"
  | "reconciled_at"
  | "notes"
> {}

export class WalletSummary
  extends Model<WalletSummaryAttributes, WalletSummaryCreationAttributes>
  implements WalletSummaryAttributes
{
  declare id: number;
  declare wallet_id: number;
  declare branch_id: number;
  declare summary_date: Date;
  declare opening_balance: number;
  declare total_deposits: number;
  declare total_transfers_in: number;
  declare total_withdrawals: number;
  declare total_transfers_out: number;
  declare total_purchases: number;
  declare total_restocks: number;
  declare total_refunds: number;
  declare closing_balance: number;
  declare transaction_count: number;
  declare average_transaction_amount: number;
  declare highest_transaction: number;
  declare lowest_transaction: number;
  declare bank_balance_at_date: number | null;
  declare is_reconciled: boolean;
  declare reconciled_at: Date | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  public static associate(models: any) {
    WalletSummary.belongsTo(models.Wallet, {
      foreignKey: "wallet_id",
      as: "wallet",
    });

    WalletSummary.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
  }

  public static initModel(sequelize: Sequelize): typeof WalletSummary {
    WalletSummary.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        wallet_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "wallets",
            key: "id",
          },
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "branches",
            key: "id",
          },
        },
        summary_date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          validate: {
            isDate: true,
          },
        },
        opening_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
          },
        },
        total_deposits: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_transfers_in: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_withdrawals: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_transfers_out: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_purchases: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_restocks: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_refunds: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        closing_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
          },
        },
        transaction_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0,
          },
        },
        average_transaction_amount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        highest_transaction: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        lowest_transaction: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        bank_balance_at_date: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        is_reconciled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        reconciled_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "wallet_summaries",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "unique_wallet_date_summary",
            unique: true,
            fields: ["wallet_id", "summary_date"],
          },
          {
            name: "idx_wallet_summary_wallet",
            fields: ["wallet_id"],
          },
          {
            name: "idx_wallet_summary_date",
            fields: ["summary_date"],
          },
          {
            name: "idx_wallet_summary_branch",
            fields: ["branch_id"],
          },
          {
            name: "idx_wallet_summary_reconciled",
            fields: ["is_reconciled"],
          },
        ],
      },
    );

    return WalletSummary;
  }
}

// Helper function to generate daily wallet summary
export async function generateWalletSummary(
  sequelize: Sequelize,
  walletId: number,
  date: Date = new Date(),
): Promise<WalletSummary> {
  const { Op } = require("sequelize");
  const Wallet = require("./Wallet").Wallet;
  const WalletTransaction = require("./WalletTransaction").WalletTransaction;
  const { TransactionType } = require("./WalletTransaction");

  const transaction = await sequelize.transaction();

  try {
    // Get the wallet
    const wallet = await Wallet.findByPk(walletId, { transaction });
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Set date range for the summary day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get previous day's closing balance as opening balance
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    previousDay.setHours(0, 0, 0, 0);

    const previousSummary = await WalletSummary.findOne({
      where: {
        wallet_id: walletId,
        summary_date: previousDay,
      },
      order: [["summary_date", "DESC"]],
      transaction,
    });

    const openingBalance = previousSummary
      ? Number(previousSummary.closing_balance)
      : Number(wallet.balance);

    // Get all transactions for the day
    const transactions = await WalletTransaction.findAll({
      where: {
        wallet_id: walletId,
        created_at: {
          [Op.between]: [startDate, endDate],
        },
        status: "completed",
      },
      transaction,
    });

    // Calculate totals by transaction type
    let totalDeposits = 0;
    let totalTransfersIn = 0;
    let totalWithdrawals = 0;
    let totalTransfersOut = 0;
    let totalPurchases = 0;
    let totalRestocks = 0;
    let totalRefunds = 0;
    let transactionCount = transactions.length;
    let highestTransaction = 0;
    let lowestTransaction = 0;
    let totalTransactionAmount = 0;

    transactions.forEach((tx: any) => {
      const amount = Number(tx.amount);
      totalTransactionAmount += amount;

      if (amount > highestTransaction) highestTransaction = amount;
      if (lowestTransaction === 0 || amount < lowestTransaction)
        lowestTransaction = amount;

      switch (tx.transaction_type) {
        case TransactionType.DEPOSIT:
          totalDeposits += amount;
          break;
        case TransactionType.WITHDRAWAL:
          totalWithdrawals += amount;
          break;
        case TransactionType.PURCHASE:
          totalPurchases += amount;
          break;
        case TransactionType.RESTOCK:
          totalRestocks += amount;
          break;
        case TransactionType.REFUND:
          totalRefunds += amount;
          break;
        case TransactionType.TRANSFER:
          if (tx.from_wallet_id === walletId) {
            totalTransfersOut += amount;
          } else if (tx.to_wallet_id === walletId) {
            totalTransfersIn += amount;
          }
          break;
      }
    });

    const averageTransactionAmount =
      transactionCount > 0 ? totalTransactionAmount / transactionCount : 0;

    // Calculate closing balance
    const totalInflows = totalDeposits + totalTransfersIn + totalRefunds;
    const totalOutflows =
      totalWithdrawals + totalTransfersOut + totalPurchases + totalRestocks;
    const closingBalance = openingBalance + totalInflows - totalOutflows;

    // Create or update summary
    const [summary, created] = await WalletSummary.findOrCreate({
      where: {
        wallet_id: walletId,
        summary_date: startDate,
      },
      defaults: {
        wallet_id: walletId, // Add wallet_id here
        summary_date: startDate, // Add summary_date here
        branch_id: wallet.branch_id,
        opening_balance: openingBalance,
        total_deposits: totalDeposits,
        total_transfers_in: totalTransfersIn,
        total_withdrawals: totalWithdrawals,
        total_transfers_out: totalTransfersOut,
        total_purchases: totalPurchases,
        total_restocks: totalRestocks,
        total_refunds: totalRefunds,
        closing_balance: closingBalance,
        transaction_count: transactionCount,
        average_transaction_amount: averageTransactionAmount,
        highest_transaction: highestTransaction,
        lowest_transaction: lowestTransaction,
      },
      transaction,
    });

    if (!created) {
      // Update existing summary
      summary.opening_balance = openingBalance;
      summary.total_deposits = totalDeposits;
      summary.total_transfers_in = totalTransfersIn;
      summary.total_withdrawals = totalWithdrawals;
      summary.total_transfers_out = totalTransfersOut;
      summary.total_purchases = totalPurchases;
      summary.total_restocks = totalRestocks;
      summary.total_refunds = totalRefunds;
      summary.closing_balance = closingBalance;
      summary.transaction_count = transactionCount;
      summary.average_transaction_amount = averageTransactionAmount;
      summary.highest_transaction = highestTransaction;
      summary.lowest_transaction = lowestTransaction;
      await summary.save({ transaction });
    }

    await transaction.commit();
    return summary;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Helper function to reconcile wallet with bank statement
export async function reconcileWallet(
  sequelize: Sequelize,
  walletId: number,
  date: Date,
  bankBalance: number,
  notes?: string,
): Promise<WalletSummary> {
  const transaction = await sequelize.transaction();

  try {
    const summary = await WalletSummary.findOne({
      where: {
        wallet_id: walletId,
        summary_date: date,
      },
      transaction,
    });

    if (!summary) {
      throw new Error("Wallet summary not found for the specified date");
    }

    summary.bank_balance_at_date = bankBalance;
    summary.is_reconciled = true;
    summary.reconciled_at = new Date();
    if (notes) {
      summary.notes = notes;
    }

    await summary.save({ transaction });
    await transaction.commit();

    return summary;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Helper function to get wallet summary for a date range
export async function getWalletSummariesForPeriod(
  sequelize: Sequelize,
  walletId: number,
  startDate: Date,
  endDate: Date,
): Promise<WalletSummary[]> {
  const { Op } = require("sequelize");

  const summaries = await WalletSummary.findAll({
    where: {
      wallet_id: walletId,
      summary_date: {
        [Op.between]: [startDate, endDate],
      },
    },
    order: [["summary_date", "ASC"]],
  });

  return summaries;
}

// Helper function to get wallet performance metrics
export async function getWalletMetrics(
  sequelize: Sequelize,
  walletId: number,
  startDate: Date,
  endDate: Date,
): Promise<{
  total_inflow: number;
  total_outflow: number;
  net_flow: number;
  average_daily_balance: number;
  total_transactions: number;
  average_transaction_value: number;
}> {
  const summaries = await getWalletSummariesForPeriod(
    sequelize,
    walletId,
    startDate,
    endDate,
  );

  let totalInflow = 0;
  let totalOutflow = 0;
  let totalBalance = 0;
  let totalTransactions = 0;
  let totalTransactionValue = 0;

  summaries.forEach((summary) => {
    totalInflow +=
      Number(summary.total_deposits) +
      Number(summary.total_transfers_in) +
      Number(summary.total_refunds);
    totalOutflow +=
      Number(summary.total_withdrawals) +
      Number(summary.total_transfers_out) +
      Number(summary.total_purchases) +
      Number(summary.total_restocks);
    totalBalance += Number(summary.closing_balance);
    totalTransactions += summary.transaction_count;
    totalTransactionValue +=
      Number(summary.average_transaction_amount) * summary.transaction_count;
  });

  const netFlow = totalInflow - totalOutflow;
  const averageDailyBalance =
    summaries.length > 0 ? totalBalance / summaries.length : 0;
  const averageTransactionValue =
    totalTransactions > 0 ? totalTransactionValue / totalTransactions : 0;

  return {
    total_inflow: totalInflow,
    total_outflow: totalOutflow,
    net_flow: netFlow,
    average_daily_balance: averageDailyBalance,
    total_transactions: totalTransactions,
    average_transaction_value: averageTransactionValue,
  };
}
