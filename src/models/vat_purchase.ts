// models/VATPurchase.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { Op } from "sequelize";
export enum VATStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface VATPurchaseAttributes {
  id: number;
  vat_number: string;
  purchase_order_id: number | null;
  branch_id: number;
  product_id: number | null;
  product_name: string | null;
  product_group: string | null;
  sku: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  vat_rate: number;
  vat_amount: number;
  total_with_vat: number;
  calculated_selling_price: number | null;
  calculated_selling_price_with_vat: number | null;
  current_stock: number;
  sold_quantity: number;
  sold_value: number;
  sold_vat: number;
  current_value: number;
  current_vat: number;
  supplier_name: string | null;
  invoice_number: string | null;
  purchase_date: Date;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: number;
  use_wallet_payment: boolean;
  wallet_id: number | null;
  wallet_transaction_id: number | null;
}

interface VATPurchaseCreationAttributes extends Optional<
  VATPurchaseAttributes,
  | "id"
  | "created_at"
  | "updated_at"
  | "purchase_order_id"
  | "product_id"
  | "product_name"
  | "product_group"
  | "sku"
  | "calculated_selling_price"
  | "calculated_selling_price_with_vat"
  | "supplier_name"
  | "invoice_number"
  | "notes"
  | "wallet_id"
  | "wallet_transaction_id"
  | "use_wallet_payment"
  | "vat_rate"
  | "current_stock"
  | "sold_quantity"
  | "sold_value"
  | "sold_vat"
  | "current_value"
  | "current_vat"
  | "status"
> {
  status?: string;
  vat_rate?: number;
  current_stock?: number;
  sold_quantity?: number;
  sold_value?: number;
  sold_vat?: number;
  current_value?: number;
  current_vat?: number;
}

export class VATPurchase
  extends Model<VATPurchaseAttributes, VATPurchaseCreationAttributes>
  implements VATPurchaseAttributes
{
  declare id: number;
  declare vat_number: string;
  declare purchase_order_id: number | null;
  declare branch_id: number;
  declare product_id: number | null;
  declare product_name: string | null;
  declare product_group: string | null;
  declare sku: string | null;
  declare quantity: number;
  declare unit_cost: number;
  declare total_cost: number;
  declare vat_rate: number;
  declare vat_amount: number;
  declare total_with_vat: number;
  declare calculated_selling_price: number | null;
  declare calculated_selling_price_with_vat: number | null;
  declare current_stock: number;
  declare sold_quantity: number;
  declare sold_value: number;
  declare sold_vat: number;
  declare current_value: number;
  declare current_vat: number;
  declare supplier_name: string | null;
  declare invoice_number: string | null;
  declare purchase_date: Date;
  declare status: string;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare created_by: number;
  declare use_wallet_payment: boolean;
  declare wallet_id: number | null;
  declare wallet_transaction_id: number | null;

  // Associations
  public static associate(models: any) {
    VATPurchase.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });

    VATPurchase.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });

    VATPurchase.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });

    VATPurchase.belongsTo(models.PurchaseOrder, {
      foreignKey: "purchase_order_id",
      as: "purchase_order",
    });

    VATPurchase.hasMany(models.VATSale, {
      foreignKey: "vat_purchase_id",
      as: "vat_sales",
      onDelete: "CASCADE",
    });

    VATPurchase.belongsTo(models.Wallet, {
      foreignKey: "wallet_id",
      as: "wallet",
    });

    VATPurchase.belongsTo(models.WalletTransaction, {
      foreignKey: "wallet_transaction_id",
      as: "wallet_transaction",
    });
  }

  public static initModel(sequelize: Sequelize): typeof VATPurchase {
    VATPurchase.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        vat_number: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        purchase_order_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "purchase_orders",
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
        product_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "products",
            key: "id",
          },
        },
        product_name: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        product_group: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        sku: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        quantity: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        unit_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        vat_rate: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 15.0,
          validate: {
            isDecimal: true,
            min: 0,
            max: 100,
          },
        },
        vat_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_with_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        calculated_selling_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        calculated_selling_price_with_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        current_stock: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        sold_quantity: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        sold_value: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        sold_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        current_value: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        current_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        supplier_name: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        invoice_number: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        purchase_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: VATStatus.PENDING,
          validate: {
            isIn: [Object.values(VATStatus)],
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
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        use_wallet_payment: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        wallet_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "wallets",
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
      },
      {
        sequelize,
        tableName: "vat_purchases",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "idx_vat_purchase_branch",
            fields: ["branch_id"],
          },
          {
            name: "idx_vat_purchase_product",
            fields: ["product_id"],
          },
          {
            name: "idx_vat_purchase_group",
            fields: ["product_group"],
          },
          {
            name: "idx_vat_purchase_date",
            fields: ["purchase_date"],
          },
          {
            name: "idx_vat_purchase_status",
            fields: ["status"],
          },
          {
            name: "idx_vat_purchase_vat_number",
            unique: true,
            fields: ["vat_number"],
          },
        ],
      },
    );

    return VATPurchase;
  }
}

// Helper method to generate VAT number (can be used as a class method)
export const generateVATNumber = async function (): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  // Get count for today
  const todayStart = new Date(year, date.getMonth(), date.getDate());
  const todayEnd = new Date(year, date.getMonth(), date.getDate(), 23, 59, 59);

  const count = await VATPurchase.count({
    where: {
      created_at: {
        [Op.between]: [todayStart, todayEnd],
      },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `VAT-${year}${month}${day}-${sequence}`;
};
