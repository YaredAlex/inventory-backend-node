// models/bank_account.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BankAccountAttributes {
  id: number;
  branch_id: number;
  bank_name: string;
  branch_name: string | null;
  account_number: string;
  account_name: string;
  account_type: string;
  iban: string | null;
  swift_code: string | null;
  currency: string;
  current_balance: number;
  is_active: boolean;
  is_primary: boolean;
  account_category: string;
  last_reconciled_at: Date | null;
  last_reconciled_balance: number | null;
  notes: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date | null;
}

interface BankAccountCreationAttributes extends Optional<
  BankAccountAttributes,
  | "id"
  | "branch_name"
  | "iban"
  | "swift_code"
  | "current_balance"
  | "is_active"
  | "is_primary"
  | "account_category"
  | "last_reconciled_at"
  | "last_reconciled_balance"
  | "notes"
  | "created_at"
  | "updated_at"
  | "account_type"
  | "currency"
  | "created_by"
> {
  account_type?: string;
  currency?: string;
}

export class BankAccount
  extends Model<BankAccountAttributes, BankAccountCreationAttributes>
  implements BankAccountAttributes
{
  declare id: number;
  declare branch_id: number;
  declare bank_name: string;
  declare branch_name: string | null;
  declare account_number: string;
  declare account_name: string;
  declare account_type: string;
  declare iban: string | null;
  declare swift_code: string | null;
  declare currency: string;
  declare current_balance: number;
  declare is_active: boolean;
  declare is_primary: boolean;
  declare account_category: string;
  declare last_reconciled_at: Date | null;
  declare last_reconciled_balance: number | null;
  declare notes: string | null;
  declare created_by: number;
  declare created_at: Date;
  declare updated_at: Date | null;

  // Associations
  public static associate(models: any) {
    BankAccount.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });

    BankAccount.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });

    BankAccount.hasMany(models.Wallet, {
      foreignKey: "bank_account_id",
      as: "wallets",
      onDelete: "SET NULL",
    });

    BankAccount.hasMany(models.BankTransaction, {
      foreignKey: "bank_account_id",
      as: "bank_transactions",
      onDelete: "CASCADE",
    });

    BankAccount.hasMany(models.Sale, {
      foreignKey: "bank_account_id",
      as: "sales",
      onDelete: "SET NULL",
    });

    BankAccount.hasMany(models.Refund, {
      foreignKey: "bank_account_id",
      as: "refunds",
      onDelete: "SET NULL",
    });

    BankAccount.hasMany(models.PurchaseOrder, {
      foreignKey: "bank_account_id",
      as: "purchase_orders",
      onDelete: "SET NULL",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BankAccount {
    BankAccount.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "branches",
            key: "id",
          },
        },
        bank_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        branch_name: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        account_number: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        account_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        account_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: "checking",
          validate: {
            isIn: [["checking", "savings", "business"]],
          },
        },
        iban: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        swift_code: {
          type: DataTypes.STRING(20),
          allowNull: true,
        },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          defaultValue: "ETB",
        },
        current_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
          },
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        is_primary: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        account_category: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: "regular",
          validate: {
            isIn: [["regular", "vat"]],
          },
        },
        last_reconciled_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        last_reconciled_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
          },
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
          allowNull: true,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "bank_accounts",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "unique_branch_account",
            unique: true,
            fields: ["branch_id", "account_number"],
          },
          {
            name: "idx_bank_account_branch",
            fields: ["branch_id"],
          },
          {
            name: "idx_bank_account_active",
            fields: ["is_active"],
          },
          {
            name: "idx_bank_account_category",
            fields: ["account_category"],
          },
          {
            name: "idx_bank_account_primary",
            fields: ["is_primary"],
          },
          {
            name: "idx_bank_account_iban",
            fields: ["iban"],
          },
        ],
      },
    );

    return BankAccount;
  }
}
