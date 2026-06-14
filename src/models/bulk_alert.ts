import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BulkAlertAttributes {
  id: number;
  bulk_product_id: number;
  branch_id: number;
  category: string | null;
  message: string;
  is_read: boolean;
  created_at: Date;
}

interface BulkAlertCreationAttributes extends Optional<
  BulkAlertAttributes,
  "id" | "created_at" | "category" | "is_read"
> {}

export class BulkAlert
  extends Model<BulkAlertAttributes, BulkAlertCreationAttributes>
  implements BulkAlertAttributes
{
  declare id: number;
  declare bulk_product_id: number;
  declare branch_id: number;
  declare category: string | null;
  declare message: string;
  declare is_read: boolean;
  declare created_at: Date;

  public static associate(models: any) {
    BulkAlert.belongsTo(models.BulkProduct, {
      foreignKey: "bulk_product_id",
      as: "product",
    });
    BulkAlert.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BulkAlert {
    BulkAlert.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        bulk_product_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "bulk_products",
            key: "id",
          },
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "branches",
            key: "id",
          },
        },
        category: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        is_read: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "bulk_alerts",
        timestamps: false,
        underscored: true,
        indexes: [
          { fields: ["bulk_product_id"] },
          { fields: ["branch_id"] },
          { fields: ["is_read"] },
          { fields: ["created_at"] },
        ],
      },
    );

    return BulkAlert;
  }
}
