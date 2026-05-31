import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface SystemSettingAttributes {
  id: number;
  category: string;
  key: string;
  value: string | null;
  created_at: Date;
  updated_at: Date | null;
}

interface SystemSettingCreationAttributes extends Optional<
  SystemSettingAttributes,
  "id" | "value" | "created_at" | "updated_at"
> {}

export class SystemSetting
  extends Model<SystemSettingAttributes, SystemSettingCreationAttributes>
  implements SystemSettingAttributes
{
  declare id: number;
  declare category: string;
  declare key: string;
  declare value: string | null;
  declare created_at: Date;
  declare updated_at: Date | null;

  public static associate(models: any) {
    // No associations
  }

  public static initModel(sequelize: Sequelize): typeof SystemSetting {
    SystemSetting.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        category: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        key: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        value: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "system_settings",
        timestamps: false,
        underscored: true,
        indexes: [{ unique: true, fields: ["category", "key"] }],
      },
    );

    return SystemSetting;
  }
}
