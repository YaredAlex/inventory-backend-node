import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface AlertAttributes {
  id: number;
  branch_id: number;
  product_id: number;
  message: string;
  created_at: Date;
  resolved: boolean;
  resolved_at: Date | null;
}

interface AlertCreationAttributes extends Optional<
  AlertAttributes,
  "id" | "created_at" | "resolved" | "resolved_at"
> {}

export class Alert
  extends Model<AlertAttributes, AlertCreationAttributes>
  implements AlertAttributes
{
  declare id: number;
  declare branch_id: number;
  declare product_id: number;
  declare message: string;
  declare created_at: Date;
  declare resolved: boolean;
  declare resolved_at: Date | null;

  public static associate(models: any) {
    Alert.belongsTo(models.Branch, { foreignKey: "branch_id", as: "branch" });
    Alert.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Alert {
    Alert.init(
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
        product_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "products",
            key: "id",
          },
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        resolved: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        resolved_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "alerts",
        timestamps: false,
        underscored: true,
      },
    );

    return Alert;
  }
}
