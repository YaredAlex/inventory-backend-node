import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { RefundStatus } from "./sale.js";

export enum RefundMethod {
  CASH = "cash",
  TRANSFER = "transfer",
  ORIGINAL_METHOD = "original_method",
}

interface RefundAttributes {
  id: number;
  refund_number: string;
  original_sale_id: number;
  branch_id: number;
  user_id: number;
  customer_name: string | null;
  refund_amount: number;
  refund_reason: string;
  refund_method: RefundMethod;
  bank_account_id: number | null;
  transaction_reference: string | null;
  status: RefundStatus;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
  completed_at: Date | null;
  notes: string | null;
}

interface RefundCreationAttributes extends Optional<
  RefundAttributes,
  | "id"
  | "customer_name"
  | "bank_account_id"
  | "transaction_reference"
  | "approved_by"
  | "approved_at"
  | "completed_at"
  | "notes"
  | "created_at"
> {}

export class Refund
  extends Model<RefundAttributes, RefundCreationAttributes>
  implements RefundAttributes
{
  declare id: number;
  declare refund_number: string;
  declare original_sale_id: number;
  declare branch_id: number;
  declare user_id: number;
  declare customer_name: string | null;
  declare refund_amount: number;
  declare refund_reason: string;
  declare refund_method: RefundMethod;
  declare bank_account_id: number | null;
  declare transaction_reference: string | null;
  declare status: RefundStatus;
  declare approved_by: number | null;
  declare approved_at: Date | null;
  declare created_at: Date;
  declare completed_at: Date | null;
  declare notes: string | null;

  public static associate(models: any) {
    Refund.belongsTo(models.Sale, {
      foreignKey: "original_sale_id",
      as: "original_sale",
    });
    Refund.belongsTo(models.Branch, { foreignKey: "branch_id", as: "branch" });
    Refund.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    Refund.belongsTo(models.User, {
      foreignKey: "approved_by",
      as: "approver",
    });
    Refund.belongsTo(models.BankAccount, {
      foreignKey: "bank_account_id",
      as: "bank_account",
    });
    Refund.hasMany(models.RefundItem, {
      foreignKey: "refund_id",
      as: "items",
      onDelete: "CASCADE",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Refund {
    Refund.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        refund_number: {
          type: DataTypes.STRING(50),
          unique: true,
          allowNull: false,
        },
        original_sale_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "sales",
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
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        customer_name: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        refund_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        refund_reason: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        refund_method: {
          type: DataTypes.ENUM(...Object.values(RefundMethod)),
          allowNull: false,
        },
        bank_account_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "bank_accounts",
            key: "id",
          },
        },
        transaction_reference: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(RefundStatus)),
          defaultValue: RefundStatus.PENDING,
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
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        completed_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "refunds",
        timestamps: false,
        underscored: true,
      },
    );

    return Refund;
  }
}
