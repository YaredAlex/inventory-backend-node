import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export enum TempItemStatus {
  PENDING = "pending",
  RECEIVED = "received",
  CANCELLED = "cancelled",
}

interface TempItemAttributes {
  id: number;
  item_number: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: TempItemStatus;
  registered_by: number;
  registered_at: Date;
  received_by: number | null;
  received_at: Date | null;
  notes: string | null;
}

interface TempItemCreationAttributes extends Optional<
  TempItemAttributes,
  | "id"
  | "description"
  | "quantity"
  | "unit_price"
  | "customer_name"
  | "customer_phone"
  | "received_by"
  | "received_at"
  | "notes"
> {}

export class TempItem
  extends Model<TempItemAttributes, TempItemCreationAttributes>
  implements TempItemAttributes
{
  public id!: number;
  public item_number!: string;
  public item_name!: string;
  public description!: string | null;
  public quantity!: number;
  public unit_price!: number | null;
  public customer_name!: string | null;
  public customer_phone!: string | null;
  public status!: TempItemStatus;
  public registered_by!: number;
  public registered_at!: Date;
  public received_by!: number | null;
  public received_at!: Date | null;
  public notes!: string | null;

  public static associate(models: any) {
    TempItem.belongsTo(models.User, {
      foreignKey: "registered_by",
      as: "registrar",
    });
    TempItem.belongsTo(models.User, {
      foreignKey: "received_by",
      as: "receiver",
    });
  }

  public static initModel(sequelize: Sequelize): typeof TempItem {
    TempItem.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        item_number: {
          type: DataTypes.STRING(50),
          unique: true,
          allowNull: false,
        },
        item_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        quantity: {
          type: DataTypes.INTEGER,
          defaultValue: 1,
        },
        unit_price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
        },
        customer_name: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        customer_phone: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(TempItemStatus)),
          defaultValue: TempItemStatus.PENDING,
        },
        registered_by: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        registered_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
        received_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
        },
        received_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "temp_items",
        timestamps: false,
        underscored: true,
      },
    );

    return TempItem;
  }
}
