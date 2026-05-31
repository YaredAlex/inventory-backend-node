import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface PurchaseItemAttributes {
  id: number;
  purchase_id: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
}

interface PurchaseItemCreationAttributes extends Optional<
  PurchaseItemAttributes,
  "id"
> {}

export class PurchaseItem
  extends Model<PurchaseItemAttributes, PurchaseItemCreationAttributes>
  implements PurchaseItemAttributes
{
  declare id: number;
  declare purchase_id: number;
  declare product_id: number;
  declare quantity: number;
  declare unit_cost: number;

  public static associate(models: any) {
    PurchaseItem.belongsTo(models.Purchase, {
      foreignKey: "purchase_id",
      as: "purchase",
    });
    PurchaseItem.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
  }

  public static initModel(sequelize: Sequelize): typeof PurchaseItem {
    PurchaseItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        purchase_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "purchases",
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
        unit_cost: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "purchase_items",
        timestamps: false,
        underscored: true,
      },
    );

    return PurchaseItem;
  }
}
