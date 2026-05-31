import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface PurchaseAttributes {
  id: number;
  branch_id: number;
  supplier_name: string | null;
  total_amount: number;
  purchase_order_id: number | null;
  created_at: Date;
}

interface PurchaseCreationAttributes extends Optional<
  PurchaseAttributes,
  "id" | "supplier_name" | "purchase_order_id" | "created_at"
> {}

export class Purchase
  extends Model<PurchaseAttributes, PurchaseCreationAttributes>
  implements PurchaseAttributes
{
  declare id: number;
  declare branch_id: number;
  declare supplier_name: string | null;
  declare total_amount: number;
  declare purchase_order_id: number | null;
  declare created_at: Date;

  public static associate(models: any) {
    Purchase.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
    Purchase.belongsTo(models.PurchaseOrder, {
      foreignKey: "purchase_order_id",
      as: "purchase_order",
    });
    Purchase.hasMany(models.PurchaseItem, {
      foreignKey: "purchase_id",
      as: "items",
      onDelete: "CASCADE",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Purchase {
    Purchase.init(
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
        supplier_name: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        total_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        purchase_order_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "purchase_orders",
            key: "id",
          },
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "purchases",
        timestamps: false,
        underscored: true,
      },
    );

    return Purchase;
  }
}
