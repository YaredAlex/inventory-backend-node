import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export enum MovementType {
  SALE = "sale",
  PURCHASE = "purchase",
  RETURN = "return",
  ADJUSTMENT = "adjustment",
  TRANSFER = "transfer",
  LOAN = "loan",
  REFUND = "refund",
  ADD = "add",
  VATSALEOUT = "vat_sale_out",
  VATPURCHASEIN = "vat_purchase_in",
}

interface StockMovementAttributes {
  id: number;
  branch_id: number;
  product_id: number;
  user_id: number;
  change_qty: number;
  movement_type: MovementType;
  with_vat: boolean;
  reference_id: number | null;
  notes: string | null;
  created_at: Date;
}

interface StockMovementCreationAttributes extends Optional<
  StockMovementAttributes,
  "id" | "with_vat" | "reference_id" | "notes" | "created_at"
> {}

export class StockMovement
  extends Model<StockMovementAttributes, StockMovementCreationAttributes>
  implements StockMovementAttributes
{
  declare id: number;
  declare branch_id: number;
  declare product_id: number;
  declare user_id: number;
  declare change_qty: number;
  declare movement_type: MovementType;
  declare with_vat: boolean;
  declare reference_id: number | null;
  declare notes: string | null;
  declare created_at: Date;

  public static associate(models: any) {
    StockMovement.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
    StockMovement.belongsTo(models.Product, {
      foreignKey: "product_id",
      as: "product",
    });
    StockMovement.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
  }

  public static initModel(sequelize: Sequelize): typeof StockMovement {
    StockMovement.init(
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
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        change_qty: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        movement_type: {
          type: DataTypes.ENUM(...Object.values(MovementType)),
          allowNull: false,
        },
        with_vat: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        reference_id: {
          type: DataTypes.INTEGER,
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
        tableName: "stock_movements",
        timestamps: false,
        underscored: true,
      },
    );

    return StockMovement;
  }
}
