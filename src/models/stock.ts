import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface StockAttributes {
  id: number;
  branch_id: number;
  product_id: number;
  quantity: number;
  quantity_with_vat: number;
  quantity_without_vat: number;
  reorder_level: number;
}

interface StockCreationAttributes extends Optional<
  StockAttributes,
  | "id"
  | "quantity"
  | "quantity_with_vat"
  | "quantity_without_vat"
  | "reorder_level"
> {}

export class Stock
  extends Model<StockAttributes, StockCreationAttributes>
  implements StockAttributes
{
  declare id: number;
  declare branch_id: number;
  declare product_id: number;
  declare quantity: number;
  declare quantity_with_vat: number;
  declare quantity_without_vat: number;
  declare reorder_level: number;

  public static associate(models: any) {
    Stock.belongsTo(models.Branch, { foreignKey: "branch_id", as: "branch" });
    Stock.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Stock {
    Stock.init(
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
        product_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "products",
            key: "id",
          },
        },
        quantity: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        quantity_with_vat: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        quantity_without_vat: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        reorder_level: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
      },
      {
        sequelize,
        tableName: "stock",
        timestamps: false,
        underscored: true,
        indexes: [{ unique: true, fields: ["branch_id", "product_id"] }],
      },
    );

    return Stock;
  }
}
