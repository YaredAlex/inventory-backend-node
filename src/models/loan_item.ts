import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface LoanItemAttributes {
  id: number;
  loan_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  sale_item_id: number | null;
}

interface LoanItemCreationAttributes extends Optional<
  LoanItemAttributes,
  "id" | "sale_item_id"
> {}

export class LoanItem
  extends Model<LoanItemAttributes, LoanItemCreationAttributes>
  implements LoanItemAttributes
{
  public id!: number;
  public loan_id!: number;
  public product_id!: number;
  public quantity!: number;
  public unit_price!: number;
  public line_total!: number;
  public sale_item_id!: number | null;

  public static associate(models: any) {
    LoanItem.belongsTo(models.Loan, { foreignKey: "loan_id", as: "loan" });
    LoanItem.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
    LoanItem.belongsTo(models.SaleItem, {
      foreignKey: "sale_item_id",
      as: "sale_item",
    });
  }

  public static initModel(sequelize: Sequelize): typeof LoanItem {
    LoanItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        loan_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "loans",
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
        line_total: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        sale_item_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "sale_items",
            key: "id",
          },
        },
      },
      {
        sequelize,
        tableName: "loan_items",
        timestamps: false,
        underscored: true,
      },
    );

    return LoanItem;
  }
}
