import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BulkStockAttributes {
  id: number;
  branch_id: number;
  bulk_product_id: number;
  category: string | null;
  unit_of_measure: string | null; // m², ft², cm²
  total_area: number; // current stock in square meters/feet
  reorder_level: number; // minimum stock before reorder alert
  created_at: Date;
  updated_at: Date;
}

interface BulkStockCreationAttributes extends Optional<
  BulkStockAttributes,
  "id" | "created_at" | "updated_at" | "category" | "reorder_level"
> {}

export class BulkStock
  extends Model<BulkStockAttributes, BulkStockCreationAttributes>
  implements BulkStockAttributes
{
  declare id: number;
  declare branch_id: number;
  declare bulk_product_id: number;
  declare category: string | null;
  declare unit_of_measure: string | null;
  declare total_area: number;
  declare reorder_level: number;
  declare created_at: Date;
  declare updated_at: Date;

  public static associate(models: any) {
    BulkStock.belongsTo(models.BulkProduct, {
      foreignKey: "bulk_product_id",
      as: "product",
    });
    BulkStock.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
    BulkStock.hasMany(models.BulkStockMovement, {
      foreignKey: "bulk_stock_id",
      as: "movements",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BulkStock {
    BulkStock.init(
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
        bulk_product_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "bulk_products",
            key: "id",
          },
        },
        category: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        total_area: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: {
              args: [0],
              msg: "Total area cannot be negative",
            },
          },
        },
        reorder_level: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 10,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
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
      },
      {
        sequelize,
        tableName: "bulk_stock",
        timestamps: false,
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ["branch_id", "bulk_product_id", "category"],
          },
        ],
        hooks: {
          beforeUpdate: (stock: BulkStock) => {
            stock.updated_at = new Date();
          },
        },
      },
    );

    return BulkStock;
  }

  // Instance method to check if stock is low
  public isLowStock(): boolean {
    return this.total_area <= this.reorder_level;
  }
}
