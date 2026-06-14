// models/Wallet.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { WalletPurpose, WalletType } from "../schemas/wallet.js";

export interface WalletAttributes {
  id: number;
  wallet_number: string;
  wallet_name: string;
  branch_id: number;
  wallet_type: string;
  wallet_purpose: string;
  balance: number;
  currency: string;
  bank_account_id: number | null;
  is_active: boolean;
  requires_approval: boolean;
  max_balance: number | null;
  min_balance: number | null;
  daily_limit: number | null;
  transaction_limit: number | null;
  description: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface WalletCreationAttributes extends Optional<
  WalletAttributes,
  | "id"
  | "created_at"
  | "updated_at"
  | "balance"
  | "currency"
  | "bank_account_id"
  | "is_active"
  | "requires_approval"
  | "max_balance"
  | "min_balance"
  | "daily_limit"
  | "transaction_limit"
  | "description"
  | "wallet_purpose"
> {
  wallet_purpose?: string;
}

export class Wallet
  extends Model<WalletAttributes, WalletCreationAttributes>
  implements WalletAttributes
{
  declare id: number;
  declare wallet_number: string;
  declare wallet_name: string;
  declare branch_id: number;
  declare wallet_type: string;
  declare wallet_purpose: string;
  declare balance: number;
  declare currency: string;
  declare bank_account_id: number | null;
  declare is_active: boolean;
  declare requires_approval: boolean;
  declare max_balance: number | null;
  declare min_balance: number | null;
  declare daily_limit: number | null;
  declare transaction_limit: number | null;
  declare description: string | null;
  declare created_by: number;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  public static associate(models: any) {
    Wallet.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });

    Wallet.belongsTo(models.BankAccount, {
      foreignKey: "bank_account_id",
      as: "bank_account",
    });

    Wallet.hasMany(models.WalletTransaction, {
      foreignKey: "wallet_id",
      as: "transactions",
      onDelete: "CASCADE",
    });

    Wallet.hasMany(models.WalletSummary, {
      foreignKey: "wallet_id",
      as: "summaries",
      onDelete: "CASCADE",
    });

    Wallet.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Wallet {
    Wallet.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        wallet_number: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        wallet_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "branches",
            key: "id",
          },
        },
        wallet_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
          validate: {
            isIn: [Object.values(WalletType)],
          },
        },
        wallet_purpose: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: WalletPurpose.OTHER,
        },
        balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
          },
        },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          defaultValue: "ETB",
        },
        bank_account_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "bank_accounts",
            key: "id",
          },
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        requires_approval: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        max_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        min_balance: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        daily_limit: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        transaction_limit: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        description: {
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
        tableName: "wallets",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "unique_branch_wallet_number",
            unique: true,
            fields: ["branch_id", "wallet_number"],
          },
          {
            name: "idx_wallet_branch",
            fields: ["branch_id"],
          },
          {
            name: "idx_wallet_type",
            fields: ["wallet_type"],
          },
          {
            name: "idx_wallet_bank_account",
            fields: ["bank_account_id"],
          },
          {
            name: "idx_wallet_active",
            fields: ["is_active"],
          },
          {
            name: "idx_wallet_number",
            fields: ["wallet_number"],
          },
        ],
      },
    );

    return Wallet;
  }
}

// Helper function to generate wallet number
export async function generateWalletNumber(
  sequelize: Sequelize,
  branchId: number,
  walletType: string,
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const prefix = walletType.substring(0, 3).toUpperCase();
  const count = await Wallet.count({
    where: {
      branch_id: branchId,
      created_at: {
        [require("sequelize").Op.between]: [
          new Date(year, date.getMonth(), date.getDate()),
          new Date(year, date.getMonth(), date.getDate(), 23, 59, 59),
        ],
      },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}-${year}${month}${day}-${sequence}`;
}
