import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface BranchAttributes {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: Date;
}

interface BranchCreationAttributes extends Optional<
  BranchAttributes,
  "id" | "created_at"
> {}

export class Branch
  extends Model<BranchAttributes, BranchCreationAttributes>
  implements BranchAttributes
{
  public id!: number;
  public name!: string;
  public address!: string | null;
  public phone!: string | null;
  public created_at!: Date;

  // Associations
  public static associate(models: any) {
    Branch.hasMany(models.User, {
      foreignKey: "branch_id",
      as: "users",
      onDelete: "CASCADE",
    });
    Branch.hasMany(models.Stock, {
      foreignKey: "branch_id",
      as: "stock",
      onDelete: "CASCADE",
    });
    Branch.hasMany(models.Sale, {
      foreignKey: "branch_id",
      as: "sales",
      onDelete: "CASCADE",
    });
    Branch.hasMany(models.Purchase, {
      foreignKey: "branch_id",
      as: "purchases",
      onDelete: "CASCADE",
    });
    Branch.hasMany(models.PurchaseOrder, {
      foreignKey: "branch_id",
      as: "purchase_orders",
      onDelete: "CASCADE",
    });
    Branch.hasMany(models.StockMovement, {
      foreignKey: "branch_id",
      as: "stock_movements",
    });
    Branch.hasMany(models.Alert, { foreignKey: "branch_id", as: "alerts" });
    Branch.hasMany(models.Loan, {
      foreignKey: "branch_id",
      as: "loans",
      onDelete: "CASCADE",
    });
    Branch.hasMany(models.BankAccount, {
      foreignKey: "branch_id",
      as: "bank_accounts",
      onDelete: "CASCADE",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Branch {
    Branch.init(
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
        address: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        phone: {
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
        tableName: "branches",
        timestamps: false,
        underscored: true,
      },
    );

    return Branch;
  }
}
