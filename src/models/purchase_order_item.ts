import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface PurchaseOrderItemAttributes {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  received_at: Date | null;
  notes: string | null;
}

interface PurchaseOrderItemCreationAttributes extends Optional<
  PurchaseOrderItemAttributes,
  "id" | "quantity_received" | "received_at" | "notes"
> {}

export class PurchaseOrderItem
  extends Model<
    PurchaseOrderItemAttributes,
    PurchaseOrderItemCreationAttributes
  >
  implements PurchaseOrderItemAttributes
{
  declare id: number;
  declare purchase_order_id: number;
  declare product_id: number;
  declare quantity_ordered: number;
  declare quantity_received: number;
  declare unit_cost: number;
  declare total_cost: number;
  declare received_at: Date | null;
  declare notes: string | null;

  public static associate(models: any) {
    PurchaseOrderItem.belongsTo(models.PurchaseOrder, {
      foreignKey: "purchase_order_id",
      as: "purchase_order",
    });
    PurchaseOrderItem.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
  }

  public static initModel(sequelize: Sequelize): typeof PurchaseOrderItem {
    PurchaseOrderItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        purchase_order_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "purchase_orders",
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
        quantity_ordered: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        quantity_received: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        unit_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        total_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        received_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "purchase_order_items",
        timestamps: false,
        underscored: true,
      },
    );

    return PurchaseOrderItem;
  }
}
