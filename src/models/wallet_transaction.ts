// models/WalletTransaction.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { Wallet } from "./wallet.js";

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
  PURCHASE = "purchase",
  RESTOCK = "restock",
  REFUND = "refund",
}

export enum TransactionMethod {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  CHECK = "check",
  CARD = "card",
  MOBILE_MONEY = "mobile_money",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface WalletTransactionAttributes {
  id: number;
  transaction_number: string;
  wallet_id: number;
  transaction_type: string;
  transaction_method: string;
  amount: number;
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  balance_before: number;
  balance_after: number;
  status: string;
  approval_status: string;
  approved_by: number | null;
  approved_at: Date | null;
  reference_type: string | null;
  reference_id: number | null;
  reference_number: string | null;
  bank_transaction_id: string | null;
  bank_reference: string | null;
  description: string | null;
  attachments: string | null;
  notes: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface WalletTransactionCreationAttributes extends Optional<
  WalletTransactionAttributes,
  | "id"
  | "created_at"
  | "updated_at"
  | "from_wallet_id"
  | "to_wallet_id"
  | "status"
  | "approval_status"
  | "approved_by"
  | "approved_at"
  | "reference_type"
  | "reference_id"
  | "reference_number"
  | "bank_transaction_id"
  | "bank_reference"
  | "description"
  | "attachments"
  | "notes"
  | "transaction_method"
> {
  transaction_method?: string;
  status?: string;
  approval_status?: string;
}

export class WalletTransaction
  extends Model<
    WalletTransactionAttributes,
    WalletTransactionCreationAttributes
  >
  implements WalletTransactionAttributes
{
  declare id: number;
  declare transaction_number: string;
  declare wallet_id: number;
  declare transaction_type: string;
  declare transaction_method: string;
  declare amount: number;
  declare from_wallet_id: number | null;
  declare to_wallet_id: number | null;
  declare balance_before: number;
  declare balance_after: number;
  declare status: string;
  declare approval_status: string;
  declare approved_by: number | null;
  declare approved_at: Date | null;
  declare reference_type: string | null;
  declare reference_id: number | null;
  declare reference_number: string | null;
  declare bank_transaction_id: string | null;
  declare bank_reference: string | null;
  declare description: string | null;
  declare attachments: string | null;
  declare notes: string | null;
  declare created_by: number;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  public static associate(models: any) {
    WalletTransaction.belongsTo(models.Wallet, {
      foreignKey: "wallet_id",
      as: "wallet",
    });

    WalletTransaction.belongsTo(models.Wallet, {
      foreignKey: "from_wallet_id",
      as: "from_wallet",
    });

    WalletTransaction.belongsTo(models.Wallet, {
      foreignKey: "to_wallet_id",
      as: "to_wallet",
    });

    WalletTransaction.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });

    WalletTransaction.belongsTo(models.User, {
      foreignKey: "approved_by",
      as: "approver",
    });
  }

  public static initModel(sequelize: Sequelize): typeof WalletTransaction {
    WalletTransaction.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        transaction_number: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        wallet_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "wallets",
            key: "id",
          },
        },
        transaction_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
          validate: {
            isIn: [Object.values(TransactionType)],
          },
        },
        transaction_method: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: TransactionMethod.CASH,
          validate: {
            isIn: [Object.values(TransactionMethod)],
          },
        },
        amount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0.01,
          },
        },
        from_wallet_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "wallets",
            key: "id",
          },
        },
        to_wallet_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "wallets",
            key: "id",
          },
        },
        balance_before: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        balance_after: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        status: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: TransactionStatus.COMPLETED,
          validate: {
            isIn: [Object.values(TransactionStatus)],
          },
        },
        approval_status: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: "approved",
        },
        approved_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
        },
        approved_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        reference_type: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        reference_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        reference_number: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        bank_transaction_id: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        bank_reference: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        attachments: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
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
        tableName: "wallet_transactions",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "idx_wallet_transaction_wallet",
            fields: ["wallet_id"],
          },
          {
            name: "idx_wallet_transaction_type",
            fields: ["transaction_type"],
          },
          {
            name: "idx_wallet_transaction_method",
            fields: ["transaction_method"],
          },
          {
            name: "idx_wallet_transaction_reference",
            fields: ["reference_type", "reference_id"],
          },
          {
            name: "idx_wallet_transaction_created",
            fields: ["created_at"],
          },
          {
            name: "idx_wallet_transaction_status",
            fields: ["status"],
          },
          {
            name: "idx_wallet_transaction_bank_ref",
            fields: ["bank_reference"],
          },
          {
            name: "idx_wallet_transaction_number",
            unique: true,
            fields: ["transaction_number"],
          },
        ],
      },
    );

    return WalletTransaction;
  }
}

// Helper function to generate transaction number
export async function generateTransactionNumber(
  sequelize: Sequelize,
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const count = await WalletTransaction.count({
    where: {
      created_at: {
        [require("sequelize").Op.between]: [
          new Date(year, date.getMonth(), date.getDate()),
          new Date(year, date.getMonth(), date.getDate(), 23, 59, 59),
        ],
      },
    },
  });

  const sequence = String(count + 1).padStart(6, "0");
  return `TXN-${year}${month}${day}-${sequence}`;
}

// Helper function to process wallet transaction
export async function processWalletTransaction(
  sequelize: Sequelize,
  walletId: number,
  amount: number,
  transactionType: TransactionType,
  createdBy: number,
  options?: {
    description?: string;
    referenceType?: string;
    referenceId?: number;
    referenceNumber?: string;
    transactionMethod?: TransactionMethod;
    notes?: string;
  },
): Promise<WalletTransaction> {
  const transaction = await sequelize.transaction();

  try {
    const wallet = await Wallet.findByPk(walletId, { transaction });

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (!wallet.is_active) {
      throw new Error("Wallet is inactive");
    }

    let newBalance = wallet.balance;

    // Calculate new balance based on transaction type
    switch (transactionType) {
      case TransactionType.DEPOSIT:
      case TransactionType.REFUND:
        newBalance = Number(wallet.balance) + amount;
        break;
      case TransactionType.WITHDRAWAL:
      case TransactionType.PURCHASE:
        if (Number(wallet.balance) < amount) {
          throw new Error("Insufficient balance");
        }
        newBalance = Number(wallet.balance) - amount;
        break;
      default:
        throw new Error(`Unsupported transaction type: ${transactionType}`);
    }

    // Check limits
    if (wallet.max_balance && newBalance > wallet.max_balance) {
      throw new Error(
        `Transaction would exceed maximum wallet balance of ${wallet.max_balance}`,
      );
    }

    if (wallet.transaction_limit && amount > wallet.transaction_limit) {
      throw new Error(
        `Transaction amount exceeds wallet limit of ${wallet.transaction_limit}`,
      );
    }

    // Create transaction record
    const transactionNumber = await generateTransactionNumber(sequelize);
    const walletTransaction = await WalletTransaction.create(
      {
        transaction_number: transactionNumber,
        wallet_id: walletId,
        transaction_type: transactionType,
        transaction_method:
          options?.transactionMethod || TransactionMethod.CASH,
        amount: amount,
        balance_before: wallet.balance,
        balance_after: newBalance,
        description: options?.description || null,
        reference_type: options?.referenceType || null,
        reference_id: options?.referenceId || null,
        reference_number: options?.referenceNumber || null,
        notes: options?.notes || null,
        created_by: createdBy,
        status: TransactionStatus.COMPLETED,
        approval_status: wallet.requires_approval ? "pending" : "approved",
      },
      { transaction },
    );

    // Update wallet balance
    wallet.balance = newBalance;
    await wallet.save({ transaction });

    await transaction.commit();
    return walletTransaction;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
