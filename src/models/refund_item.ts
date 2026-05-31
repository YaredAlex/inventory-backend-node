import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface RefundItemAttributes {
  id: number;
  refund_id: number;
  sale_item_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  refund_amount: number;
  reason: string | null;
}

interface RefundItemCreationAttributes extends Optional<
  RefundItemAttributes,
  "id" | "reason"
> {}

export class RefundItem
  extends Model<RefundItemAttributes, RefundItemCreationAttributes>
  implements RefundItemAttributes
{
  public id!: number;
  public refund_id!: number;
  public sale_item_id!: number;
  public product_id!: number;
  public quantity!: number;
  public unit_price!: number;
  public refund_amount!: number;
  public reason!: string | null;

  public static associate(models: any) {
    RefundItem.belongsTo(models.Refund, {
      foreignKey: "refund_id",
      as: "refund",
    });
    RefundItem.belongsTo(models.SaleItem, {
      foreignKey: "sale_item_id",
      as: "sale_item",
    });
    RefundItem.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
  }

  public static initModel(sequelize: Sequelize): typeof RefundItem {
    RefundItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        refund_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "refunds",
            key: "id",
          },
        },
        sale_item_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "sale_items",
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
        refund_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "refund_items",
        timestamps: false,
        underscored: true,
      },
    );

    return RefundItem;
  }
}
