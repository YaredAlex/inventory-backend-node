import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface BackupRecordAttributes {
  id: number;
  name: string;
  file_path: string;
  size_mb: number;
  created_by: number | null;
  created_at: Date;
}

interface BackupRecordCreationAttributes extends Optional<
  BackupRecordAttributes,
  "id" | "size_mb" | "created_by" | "created_at"
> {}

export class BackupRecord
  extends Model<BackupRecordAttributes, BackupRecordCreationAttributes>
  implements BackupRecordAttributes
{
  public id!: number;
  public name!: string;
  public file_path!: string;
  public size_mb!: number;
  public created_by!: number | null;
  public created_at!: Date;

  public static associate(models: any) {
    BackupRecord.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BackupRecord {
    BackupRecord.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        file_path: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        size_mb: {
          type: DataTypes.DECIMAL(10, 2),
          defaultValue: 0,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
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
        tableName: "backup_records",
        timestamps: false,
        underscored: true,
      },
    );

    return BackupRecord;
  }
}
