// models/VATSale.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface VATSaleAttributes {
  id: number;
  vat_sale_number: string;
  sale_id: number | null;
  sale_item_id: number | null;
  vat_purchase_id: number;
  branch_id: number;
  product_id: number | null;
  product_name: string | null;
  product_group: string | null;
  sku: string | null;
  quantity: number;
  unit_cost: number;
  selling_price: number;
  selling_price_with_vat: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  total_amount_with_vat: number;
  cost_of_goods_sold: number;
  profit: number;
  profit_margin: number;
  customer_name: string | null;
  invoice_number: string | null;
  sale_date: Date;
  created_at: Date;
  created_by: number;
  wallet_transaction_id: number | null;
}

interface VATSaleCreationAttributes extends Optional<
  VATSaleAttributes,
  | "id"
  | "created_at"
  | "sale_id"
  | "sale_item_id"
  | "product_id"
  | "product_name"
  | "product_group"
  | "sku"
  | "customer_name"
  | "invoice_number"
  | "wallet_transaction_id"
  | "vat_rate"
> {
  vat_rate?: number;
}

export class VATSale
  extends Model<VATSaleAttributes, VATSaleCreationAttributes>
  implements VATSaleAttributes
{
  declare id: number;
  declare vat_sale_number: string;
  declare sale_id: number | null;
  declare sale_item_id: number | null;
  declare vat_purchase_id: number;
  declare branch_id: number;
  declare product_id: number | null;
  declare product_name: string | null;
  declare product_group: string | null;
  declare sku: string | null;
  declare quantity: number;
  declare unit_cost: number;
  declare selling_price: number;
  declare selling_price_with_vat: number;
  declare vat_rate: number;
  declare vat_amount: number;
  declare total_amount: number;
  declare total_amount_with_vat: number;
  declare cost_of_goods_sold: number;
  declare profit: number;
  declare profit_margin: number;
  declare customer_name: string | null;
  declare invoice_number: string | null;
  declare sale_date: Date;
  declare created_at: Date;
  declare created_by: number;
  declare wallet_transaction_id: number | null;

  // Associations
  public static associate(models: any) {
    VATSale.belongsTo(models.Sale, {
      foreignKey: "sale_id",
      as: "sale",
    });

    VATSale.belongsTo(models.SaleItem, {
      foreignKey: "sale_item_id",
      as: "sale_item",
    });

    VATSale.belongsTo(models.VATPurchase, {
      foreignKey: "vat_purchase_id",
      as: "vat_purchase",
    });

    VATSale.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });

    VATSale.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });

    VATSale.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });

    VATSale.belongsTo(models.WalletTransaction, {
      foreignKey: "wallet_transaction_id",
      as: "wallet_transaction",
    });
  }

  public static initModel(sequelize: Sequelize): typeof VATSale {
    VATSale.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        vat_sale_number: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
        },
        sale_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "sales",
            key: "id",
          },
        },
        sale_item_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "sale_items",
            key: "id",
          },
        },
        vat_purchase_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "vat_purchases",
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
        selling_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        selling_price_with_vat: {
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
        total_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_amount_with_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        cost_of_goods_sold: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        profit: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
          },
        },
        profit_margin: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
          },
        },
        customer_name: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        invoice_number: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        sale_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        created_at: {
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
        tableName: "vat_sales",
        timestamps: false,
        underscored: true,
        indexes: [
          {
            name: "idx_vat_sale_branch",
            fields: ["branch_id"],
          },
          {
            name: "idx_vat_sale_product",
            fields: ["product_id"],
          },
          {
            name: "idx_vat_sale_group",
            fields: ["product_group"],
          },
          {
            name: "idx_vat_sale_date",
            fields: ["sale_date"],
          },
          {
            name: "idx_vat_purchase",
            fields: ["vat_purchase_id"],
          },
          {
            name: "idx_vat_sale_number",
            unique: true,
            fields: ["vat_sale_number"],
          },
        ],
      },
    );

    return VATSale;
  }
}

// Helper method to generate VAT sale number
export async function generateVATSaleNumber(
  sequelize: Sequelize,
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  // Get count for today
  const todayStart = new Date(year, date.getMonth(), date.getDate());
  const todayEnd = new Date(year, date.getMonth(), date.getDate(), 23, 59, 59);

  const { Op } = require("sequelize");
  const count = await VATSale.count({
    where: {
      created_at: {
        [Op.between]: [todayStart, todayEnd],
      },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `VATSALE-${year}${month}${day}-${sequence}`;
}
