import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export enum LogType {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  BACKUP = "backup",
  SETTINGS = "settings",
}

interface SystemLogAttributes {
  id: number;
  log_type: LogType;
  message: string;
  details: string | null;
  user_id: number | null;
  ip_address: string | null;
  created_at: Date;
}

interface SystemLogCreationAttributes extends Optional<
  SystemLogAttributes,
  "id" | "details" | "user_id" | "ip_address" | "created_at"
> {}

export class SystemLog
  extends Model<SystemLogAttributes, SystemLogCreationAttributes>
  implements SystemLogAttributes
{
  declare id: number;
  declare log_type: LogType;
  declare message: string;
  declare details: string | null;
  declare user_id: number | null;
  declare ip_address: string | null;
  declare created_at: Date;

  public static associate(models: any) {
    SystemLog.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
  }

  public static initModel(sequelize: Sequelize): typeof SystemLog {
    SystemLog.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        log_type: {
          type: DataTypes.ENUM(...Object.values(LogType)),
          allowNull: false,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        details: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
        },
        ip_address: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "system_logs",
        timestamps: false,
        underscored: true,
      },
    );

    return SystemLog;
  }
}
