import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export enum PaymentMethod {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  CHECK = "check",
  CREDIT = "credit",
}

export enum SaleStatus {
  COMPLETED = "completed",
  PENDING = "pending",
  CANCELLED = "cancelled",
}

export enum RefundStatus {
  NONE = "none",
  PARTIAL = "partial",
  FULL = "full",
}

interface SaleAttributes {
  id: number;
  invoice_number: string;
  branch_id: number;
  user_id: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  discount_amount: number;
  discount_type: string;
  shipping_cost: number;
  total_amount: number;
  total_cost: number;
  payment_method: PaymentMethod;
  bank_account_id: number | null;
  transaction_reference: string | null;
  status: SaleStatus;
  refund_amount: number;
  refund_status: RefundStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date | null;
}

interface SaleCreationAttributes extends Optional<
  SaleAttributes,
  | "id"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "tax_amount"
  | "tax_rate"
  | "discount_amount"
  | "discount_type"
  | "shipping_cost"
  | "total_cost"
  | "bank_account_id"
  | "transaction_reference"
  | "refund_amount"
  | "refund_status"
  | "notes"
  | "updated_at"
> {}

export class Sale
  extends Model<SaleAttributes, SaleCreationAttributes>
  implements SaleAttributes
{
  declare id: number;
  declare invoice_number: string;
  declare branch_id: number;
  declare user_id: number;
  declare customer_name: string | null;
  declare customer_phone: string | null;
  declare customer_email: string | null;
  declare subtotal: number;
  declare tax_amount: number;
  declare tax_rate: number;
  declare discount_amount: number;
  declare discount_type: string;
  declare shipping_cost: number;
  declare total_amount: number;
  declare total_cost: number;
  declare payment_method: PaymentMethod;
  declare bank_account_id: number | null;
  declare transaction_reference: string | null;
  declare status: SaleStatus;
  declare refund_amount: number;
  declare refund_status: RefundStatus;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date | null;

  public static associate(models: any) {
    Sale.belongsTo(models.Branch, { foreignKey: "branch_id", as: "branch" });
    Sale.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    Sale.belongsTo(models.BankAccount, {
      foreignKey: "bank_account_id",
      as: "bank_account",
    });
    Sale.hasMany(models.SaleItem, {
      foreignKey: "sale_id",
      as: "items",
      onDelete: "CASCADE",
    });
    Sale.hasMany(models.Refund, {
      foreignKey: "original_sale_id",
      as: "refunds",
      onDelete: "CASCADE",
    });
    Sale.hasMany(models.LoanPayment, {
      foreignKey: "sale_id",
      as: "loan_payments",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Sale {
    Sale.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        invoice_number: {
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
        customer_phone: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        customer_email: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        subtotal: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        tax_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        tax_rate: {
          type: DataTypes.DECIMAL(5, 2),
          defaultValue: 15,
        },
        discount_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        discount_type: {
          type: DataTypes.STRING(20),
          defaultValue: "percentage",
        },
        shipping_cost: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        total_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        total_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        payment_method: {
          type: DataTypes.ENUM(...Object.values(PaymentMethod)),
          allowNull: false,
          defaultValue: PaymentMethod.CASH,
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
          type: DataTypes.ENUM(...Object.values(SaleStatus)),
          defaultValue: SaleStatus.COMPLETED,
        },
        refund_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        refund_status: {
          type: DataTypes.ENUM(...Object.values(RefundStatus)),
          defaultValue: RefundStatus.NONE,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "sales",
        timestamps: false,
        underscored: true,
      },
    );

    return Sale;
  }
}
