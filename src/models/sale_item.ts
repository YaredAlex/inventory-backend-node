import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface SaleItemAttributes {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

interface SaleItemCreationAttributes extends Optional<
  SaleItemAttributes,
  "id" | "discount_amount"
> {}

export class SaleItem
  extends Model<SaleItemAttributes, SaleItemCreationAttributes>
  implements SaleItemAttributes
{
  declare id: number;
  declare sale_id: number;
  declare product_id: number;
  declare quantity: number;
  declare unit_price: number;
  declare discount_amount: number;
  declare line_total: number;

  public static associate(models: any) {
    SaleItem.belongsTo(models.Sale, { foreignKey: "sale_id", as: "sale" });
    SaleItem.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
    SaleItem.hasMany(models.LoanItem, {
      foreignKey: "sale_item_id",
      as: "loan_items",
    });
    SaleItem.hasMany(models.RefundItem, {
      foreignKey: "sale_item_id",
      as: "refund_items",
    });
  }

  public static initModel(sequelize: Sequelize): typeof SaleItem {
    SaleItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        sale_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "sales",
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
          allowNull: false,
        },
        unit_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        discount_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        line_total: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "sale_items",
        timestamps: false,
        underscored: true,
      },
    );

    return SaleItem;
  }
}
