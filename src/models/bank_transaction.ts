// models/bank_transaction.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BankTransactionAttributes {
  id: number;
  bank_account_id: number;
  transaction_date: Date;
  transaction_type: string; // credit, debit
  amount: number;
  description: string | null;
  reference: string | null;
  statement_date: Date | null;
  statement_balance: number | null;
  is_reconciled: boolean;
  reconciled_at: Date | null;
  reconciled_by: number | null;
  wallet_transaction_id: number | null;
  notes: string | null;
  created_at: Date;
}

interface BankTransactionCreationAttributes extends Optional<
  BankTransactionAttributes,
  | "id"
  | "created_at"
  | "description"
  | "reference"
  | "statement_date"
  | "statement_balance"
  | "is_reconciled"
  | "reconciled_at"
  | "reconciled_by"
  | "wallet_transaction_id"
  | "notes"
> {}

export class BankTransaction
  extends Model<BankTransactionAttributes, BankTransactionCreationAttributes>
  implements BankTransactionAttributes
{
  declare id: number;
  declare bank_account_id: number;
  declare transaction_date: Date;
  declare transaction_type: string;
  declare amount: number;
  declare description: string | null;
  declare reference: string | null;
  declare statement_date: Date | null;
  declare statement_balance: number | null;
  declare is_reconciled: boolean;
  declare reconciled_at: Date | null;
  declare reconciled_by: number | null;
  declare wallet_transaction_id: number | null;
  declare notes: string | null;
  declare created_at: Date;

  // Associations
  public static associate(models: any) {
    BankTransaction.belongsTo(models.BankAccount, {
      foreignKey: "bank_account_id",
      as: "bank_account",
    });

    BankTransaction.belongsTo(models.WalletTransaction, {
      foreignKey: "wallet_transaction_id",
      as: "wallet_transaction",
    });

    BankTransaction.belongsTo(models.User, {
      foreignKey: "reconciled_by",
      as: "reconciler",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BankTransaction {
    BankTransaction.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        bank_account_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "bank_accounts",
            key: "id",
          },
        },
        transaction_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        transaction_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
          validate: {
            isIn: [["credit", "debit"]],
          },
        },
        amount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        reference: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        statement_date: {
          type: DataTypes.DATEONLY,
          allowNull: true,
        },
        statement_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
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
        reconciled_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
        },
        wallet_transaction_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "wallet_transactions",
            key: "id",
          },
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
      },
      {
        sequelize,
        tableName: "bank_transactions",
        timestamps: false,
        underscored: true,
        indexes: [
          {
            name: "idx_bank_transaction_account",
            fields: ["bank_account_id"],
          },
          {
            name: "idx_bank_transaction_date",
            fields: ["transaction_date"],
          },
          {
            name: "idx_bank_transaction_reconciled",
            fields: ["is_reconciled"],
          },
          {
            name: "idx_bank_transaction_reference",
            fields: ["reference"],
          },
        ],
      },
    );

    return BankTransaction;
  }
}
