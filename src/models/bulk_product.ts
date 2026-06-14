import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BulkProductAttributes {
  id: number;
  name: string;
  description: string | null;
  unit_of_measure: string; // m², ft², cm²
  buying_price: number; // price per unit area for purchasing
  price: number; // selling price per unit area
  category_options: string[]; // array of categories/variants (e.g., ["6x60", "40x40"])
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface BulkProductCreationAttributes extends Optional<
  BulkProductAttributes,
  | "id"
  | "created_at"
  | "updated_at"
  | "description"
  | "category_options"
  | "active"
> {}

export class BulkProduct
  extends Model<BulkProductAttributes, BulkProductCreationAttributes>
  implements BulkProductAttributes
{
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare unit_of_measure: string;
  declare buying_price: number;
  declare price: number;
  declare category_options: string[];
  declare active: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  public static associate(models: any) {
    // Associate with Bulk Purchase Orders
    BulkProduct.hasMany(models.BulkPurchaseOrderItem, {
      foreignKey: "bulk_product_id",
      as: "purchase_order_items",
      onDelete: "SET NULL",
    });

    // // Associate with Bulk Purchase Orders (legacy/alternative)
    // BulkProduct.hasMany(models.BulkPurchase, {
    //   foreignKey: "bulk_product_id",
    //   as: "bulk_purchases",
    //   onDelete: "SET NULL",
    // });

    // Associate with Sale Items (if bulk products can be sold directly)
    BulkProduct.hasMany(models.BulkSaleItem, {
      foreignKey: "bulk_product_id",
      as: "sale_items",
    });

    // Associate with Stock for area-based inventory
    BulkProduct.hasMany(models.BulkStock, {
      foreignKey: "bulk_product_id",
      as: "stock",
      onDelete: "CASCADE",
    });

    // Associate with Stock Movements
    BulkProduct.hasMany(models.BulkStockMovement, {
      foreignKey: "bulk_product_id",
      as: "stock_movements",
    });

    // Associate with Alerts for reorder levels
    BulkProduct.hasMany(models.BulkAlert, {
      foreignKey: "bulk_product_id",
      as: "alerts",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BulkProduct {
    BulkProduct.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: "Product name is required",
            },
            len: {
              args: [2, 255],
              msg: "Product name must be between 2 and 255 characters",
            },
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        unit_of_measure: {
          type: DataTypes.ENUM("m²", "ft²", "cm²"),
          allowNull: false,
          defaultValue: "m²",
          validate: {
            isIn: {
              args: [["m²", "ft²", "cm²"]],
              msg: "Unit of measure must be m², ft², or cm²",
            },
          },
        },
        buying_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: {
              msg: "Buying price must be a valid decimal number",
            },
            min: {
              args: [0],
              msg: "Buying price cannot be negative",
            },
          },
        },
        price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            isDecimal: {
              msg: "Price must be a valid decimal number",
            },
            min: {
              args: [0],
              msg: "Price cannot be negative",
            },
          },
        },
        category_options: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
          validate: {
            isValidArray(value: any) {
              if (!Array.isArray(value)) {
                throw new Error("Category options must be an array");
              }
              if (value.some((item: any) => typeof item !== "string")) {
                throw new Error("Category options must be strings");
              }
            },
          },
        },
        active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "bulk_products",
        timestamps: false,
        underscored: true,
        indexes: [
          { unique: false, fields: ["name"] },
          { unique: false, fields: ["active"] },
          { unique: false, fields: ["unit_of_measure"] },
        ],
        hooks: {
          beforeUpdate: (product: BulkProduct) => {
            product.updated_at = new Date();
          },
        },
      },
    );

    return BulkProduct;
  }

  // Instance methods
  public getFormattedBuyingPrice(): string {
    return `${this.buying_price} / ${this.unit_of_measure}`;
  }

  public getFormattedSellingPrice(): string {
    return `${this.price} / ${this.unit_of_measure}`;
  }

  public hasCategories(): boolean {
    return this.category_options && this.category_options.length > 0;
  }

  public getCategories(): string[] {
    return this.category_options || [];
  }

  public addCategory(category: string): void {
    if (!this.category_options.includes(category)) {
      this.category_options.push(category);
    }
  }

  public removeCategory(category: string): void {
    this.category_options = this.category_options.filter((c) => c !== category);
  }
}

// Export default for convenience
export default BulkProduct;
