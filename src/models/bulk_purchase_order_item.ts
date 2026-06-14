import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BulkPurchaseOrderItemAttributes {
  id: number;
  bulk_purchase_order_id: number;
  bulk_product_id: number;
  selected_category: string | null;
  total_area: number; // in square meters/feet
  buying_price: number; // price per unit at time of purchase
  total_cost: number;
  created_at: Date;
  notes: string | null;
}

interface BulkPurchaseOrderItemCreationAttributes extends Optional<
  BulkPurchaseOrderItemAttributes,
  "id" | "created_at"
> {}

export class BulkPurchaseOrderItem
  extends Model<
    BulkPurchaseOrderItemAttributes,
    BulkPurchaseOrderItemCreationAttributes
  >
  implements BulkPurchaseOrderItemAttributes
{
  declare id: number;
  declare bulk_purchase_order_id: number;
  declare bulk_product_id: number;
  declare selected_category: string | null;
  declare total_area: number;
  declare buying_price: number;
  declare total_cost: number;
  declare created_at: Date;
  declare notes: string;
  public static associate(models: any) {
    BulkPurchaseOrderItem.belongsTo(models.BulkProduct, {
      foreignKey: "bulk_product_id",
      as: "product",
    });
    BulkPurchaseOrderItem.belongsTo(models.BulkPurchaseOrder, {
      foreignKey: "bulk_purchase_order_id",
      as: "purchase_order",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BulkPurchaseOrderItem {
    BulkPurchaseOrderItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        bulk_purchase_order_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "bulk_purchase_orders",
            key: "id",
          },
        },
        bulk_product_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "bulk_products",
            key: "id",
          },
        },
        selected_category: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        total_area: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0.01],
              msg: "Total area must be greater than 0",
            },
          },
        },
        buying_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          validate: {
            min: {
              args: [0],
              msg: "Buying price cannot be negative",
            },
          },
        },
        total_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "bulk_purchase_order_items",
        timestamps: false,
        underscored: true,
      },
    );

    return BulkPurchaseOrderItem;
  }
}
