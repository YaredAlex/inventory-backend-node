import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { PurchaseOrderItem } from "./purchase_order_item.js";

export enum PurchaseStatus {
  PENDING = "pending",
  APPROVED = "approved",
  SHIPPED = "shipped",
  RECEIVED = "received",
  PARTIALLY_RECEIVED = "partially_received",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

interface PurchaseOrderAttributes {
  id: number;
  order_number: string;
  branch_id: number;
  supplier: string;
  order_date: Date;
  expected_delivery_date: Date | null;
  actual_delivery_date: Date | null;
  status: PurchaseStatus;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date | null;
  bank_account_id: number | null;
  payment_reference: string | null;
  payment_date: Date | null;
  // Add items as optional since it's populated by include
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderCreationAttributes extends Optional<
  PurchaseOrderAttributes,
  | "id"
  | "order_date"
  | "created_at"
  | "expected_delivery_date"
  | "actual_delivery_date"
  | "subtotal"
  | "vat_rate"
  | "vat_amount"
  | "tax_amount"
  | "shipping_cost"
  | "discount_amount"
  | "total_amount"
  | "notes"
  | "updated_at"
  | "bank_account_id"
  | "payment_reference"
  | "payment_date"
  | "items"
> {}

export class PurchaseOrder
  extends Model<PurchaseOrderAttributes, PurchaseOrderCreationAttributes>
  implements PurchaseOrderAttributes
{
  declare id: number;
  declare order_number: string;
  declare branch_id: number;
  declare supplier: string;
  declare order_date: Date;
  declare expected_delivery_date: Date | null;
  declare actual_delivery_date: Date | null;
  declare status: PurchaseStatus;
  declare subtotal: number;
  declare vat_rate: number;
  declare vat_amount: number;
  declare tax_amount: number;
  declare shipping_cost: number;
  declare discount_amount: number;
  declare total_amount: number;
  declare notes: string | null;
  declare created_by: number;
  declare created_at: Date;
  declare updated_at: Date | null;
  declare bank_account_id: number | null;
  declare payment_reference: string | null;
  declare payment_date: Date | null;
  declare items?: PurchaseOrderItem[]; // Add this line

  public static associate(models: any) {
    PurchaseOrder.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
    PurchaseOrder.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
    PurchaseOrder.belongsTo(models.BankAccount, {
      foreignKey: "bank_account_id",
      as: "bank_account",
    });
    PurchaseOrder.hasMany(models.PurchaseOrderItem, {
      foreignKey: "purchase_order_id",
      as: "items",
      onDelete: "CASCADE",
    });
    PurchaseOrder.hasMany(models.Purchase, {
      foreignKey: "purchase_order_id",
      as: "purchases",
    });
  }

  public static initModel(sequelize: Sequelize): typeof PurchaseOrder {
    PurchaseOrder.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        order_number: {
          type: DataTypes.STRING(50),
          unique: true,
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
        supplier: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },
        order_date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
        expected_delivery_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        actual_delivery_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(PurchaseStatus)),
          defaultValue: PurchaseStatus.PENDING,
        },
        subtotal: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        vat_rate: {
          type: DataTypes.DECIMAL(5, 2),
          defaultValue: 0,
        },
        vat_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        tax_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        shipping_cost: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        discount_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        total_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
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
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        bank_account_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "bank_accounts",
            key: "id",
          },
        },
        payment_reference: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        payment_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "purchase_orders",
        timestamps: false,
        underscored: true,
      },
    );

    return PurchaseOrder;
  }
}
