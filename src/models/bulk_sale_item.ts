import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface BulkSaleItemAttributes {
  id: number;
  sale_id: number;
  bulk_product_id: number;
  selected_category: string | null;
  quantity_area: number;
  unit_price: number;
  total_price: number;
  created_at: Date;
}

interface BulkSaleItemCreationAttributes extends Optional<
  BulkSaleItemAttributes,
  "id" | "created_at" | "selected_category"
> {}

export class BulkSaleItem
  extends Model<BulkSaleItemAttributes, BulkSaleItemCreationAttributes>
  implements BulkSaleItemAttributes
{
  declare id: number;
  declare sale_id: number;
  declare bulk_product_id: number;
  declare selected_category: string | null;
  declare quantity_area: number;
  declare unit_price: number;
  declare total_price: number;
  declare created_at: Date;

  public static associate(models: any) {
    BulkSaleItem.belongsTo(models.BulkProduct, {
      foreignKey: "bulk_product_id",
      as: "product",
    });
    BulkSaleItem.belongsTo(models.Sale, {
      foreignKey: "sale_id",
      as: "sale",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BulkSaleItem {
    BulkSaleItem.init(
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
        bulk_product_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "bulk_products",
            key: "id",
          },
        },
        selected_category: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        quantity_area: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        unit_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        total_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "bulk_sale_items",
        timestamps: false,
        underscored: true,
      },
    );

    return BulkSaleItem;
  }
}
