import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import bcrypt from "bcryptjs";

export enum UserRole {
  ADMIN = "admin",
  SALESMAN = "salesman",
  PRIVILEGED_SALES = "privileged_sales",
}

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  branch_id: number | null;
  active: boolean;
  created_at: Date;
}

interface UserCreationAttributes extends Optional<
  UserAttributes,
  "id" | "created_at" | "branch_id" | "active"
> {}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  // Add 'declare' keyword to all class fields to fix the warning
  declare id: number;
  declare name: string;
  declare email: string;
  declare password_hash: string;
  declare role: UserRole;
  declare branch_id: number | null;
  declare active: boolean;
  declare created_at: Date;

  public async checkPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  public isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  public isPrivileged(): boolean {
    return (
      this.role === UserRole.ADMIN || this.role === UserRole.PRIVILEGED_SALES
    );
  }

  public canCreateLoans(): boolean {
    return this.isPrivileged();
  }

  public canApproveLoans(): boolean {
    return this.isAdmin();
  }

  public canProcessRefunds(): boolean {
    return this.isPrivileged();
  }

  public canManageUsers(): boolean {
    return this.isAdmin();
  }

  public canManageBranches(): boolean {
    return this.isAdmin();
  }

  public canViewReports(): boolean {
    return true;
  }

  public canExportData(): boolean {
    return this.isAdmin();
  }

  public static associate(models: any) {
    User.belongsTo(models.Branch, { foreignKey: "branch_id", as: "branch" });
    User.hasMany(models.Sale, { foreignKey: "user_id", as: "sales" });
    User.hasMany(models.Refund, { foreignKey: "user_id", as: "refunds" });
    User.hasMany(models.StockMovement, {
      foreignKey: "user_id",
      as: "stock_movements",
    });
    User.hasMany(models.PurchaseOrder, {
      foreignKey: "created_by",
      as: "purchase_orders",
    });
    User.hasMany(models.Loan, {
      foreignKey: "created_by",
      as: "loans_created",
    });
    User.hasMany(models.Loan, {
      foreignKey: "approved_by",
      as: "loans_approved",
    });
    User.hasMany(models.LoanPayment, {
      foreignKey: "recorded_by",
      as: "loan_payments",
    });
    User.hasMany(models.VATPurchase, {
      foreignKey: "created_by",
      as: "vat_purchases_created",
      onDelete: "CASCADE",
    });
    User.hasMany(models.VATSale, {
      foreignKey: "created_by",
      as: "vat_sales_created",
      onDelete: "CASCADE",
    });
    User.hasMany(models.VATSummary, {
      foreignKey: "created_by",
      as: "vat_summaries_created",
      onDelete: "SET NULL",
    });
    User.hasMany(models.VATRateHistory, {
      foreignKey: "created_by",
      as: "vat_rates_created",
      onDelete: "CASCADE",
    });
  }

  public static initModel(sequelize: Sequelize): typeof User {
    User.init(
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
        email: {
          type: DataTypes.STRING(255),
          unique: true,
          allowNull: false,
        },
        password_hash: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM(...Object.values(UserRole)),
          allowNull: false,
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "branches",
            key: "id",
          },
        },
        active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "users",
        timestamps: false,
        underscored: true,
      },
    );

    return User;
  }
}
