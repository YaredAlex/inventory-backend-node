import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BulkStockMovementAttributes {
  id: number;
  bulk_stock_id: number;
  quantity: number;
  type: "purchase" | "sale" | "return" | "adjustment";
  reference_id: number | null;
  reference_type: string | null;
  notes: string | null;
  created_at: Date;
}

interface BulkStockMovementCreationAttributes extends Optional<
  BulkStockMovementAttributes,
  "id" | "created_at" | "reference_id" | "reference_type" | "notes"
> {}

export class BulkStockMovement
  extends Model<
    BulkStockMovementAttributes,
    BulkStockMovementCreationAttributes
  >
  implements BulkStockMovementAttributes
{
  declare id: number;
  declare bulk_stock_id: number;
  declare quantity: number;
  declare type: "purchase" | "sale" | "return" | "adjustment";
  declare reference_id: number | null;
  declare reference_type: string | null;
  declare notes: string | null;
  declare created_at: Date;

  public static associate(models: any) {
    BulkStockMovement.belongsTo(models.BulkStock, {
      foreignKey: "bulk_stock_id",
      as: "stock",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BulkStockMovement {
    BulkStockMovement.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        bulk_stock_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "bulk_stock",
            key: "id",
          },
        },
        quantity: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        type: {
          type: DataTypes.ENUM("purchase", "sale", "return", "adjustment"),
          allowNull: false,
        },
        reference_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        reference_type: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "bulk_stock_movements",
        timestamps: false,
        underscored: true,
        indexes: [
          { fields: ["bulk_stock_id"] },
          { fields: ["type"] },
          { fields: ["created_at"] },
        ],
      },
    );

    return BulkStockMovement;
  }
}
