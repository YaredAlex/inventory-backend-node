import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface ProductAttributes {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  color: string | null;
  size: string | null;
  pages: number | null;
  price: number;
  cost: number;
  active: boolean;
  created_at: Date;
}

interface ProductCreationAttributes extends Optional<
  ProductAttributes,
  "id" | "created_at" | "description" | "color" | "size" | "pages" | "active"
> {}

export class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  declare id: number;
  declare sku: string;
  declare name: string;
  declare description: string | null;
  declare color: string | null;
  declare size: string | null;
  declare pages: number | null;
  declare price: number;
  declare cost: number;
  declare active: boolean;
  declare created_at: Date;

  public static associate(models: any) {
    Product.hasMany(models.Stock, {
      foreignKey: "product_id",
      as: "stock",
      onDelete: "CASCADE",
    });
    Product.hasMany(models.SaleItem, {
      foreignKey: "product_id",
      as: "sale_items",
    });
    Product.hasMany(models.PurchaseItem, {
      foreignKey: "product_id",
      as: "purchase_items",
    });
    Product.hasMany(models.PurchaseOrderItem, {
      foreignKey: "product_id",
      as: "purchase_order_items",
    });
    Product.hasMany(models.StockMovement, {
      foreignKey: "product_id",
      as: "stock_movements",
    });
    Product.hasMany(models.Alert, { foreignKey: "product_id", as: "alerts" });
    Product.hasMany(models.LoanItem, {
      foreignKey: "product_id",
      as: "loan_items",
    });
    Product.hasMany(models.RefundItem, {
      foreignKey: "product_id",
      as: "refund_items",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Product {
    Product.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        sku: {
          type: DataTypes.STRING(100),
          unique: true,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        color: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        size: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        pages: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "products",
        timestamps: false,
        underscored: true,
        indexes: [{ unique: true, fields: ["sku"] }],
      },
    );

    return Product;
  }
}
