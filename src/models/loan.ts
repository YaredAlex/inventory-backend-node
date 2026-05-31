import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { LoanStatus } from "../schemas/loan.js";

export enum ApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

interface LoanAttributes {
  id: number;
  loan_number: string;
  branch_id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  loan_date: Date;
  due_date: Date;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  interest_rate: number;
  interest_amount: number;
  status: LoanStatus;
  notes: string | null;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  requires_approval: boolean;
  approval_status: ApprovalStatus;
}

interface LoanCreationAttributes extends Optional<
  LoanAttributes,
  | "id"
  | "customer_phone"
  | "customer_email"
  | "paid_amount"
  | "remaining_amount"
  | "interest_rate"
  | "interest_amount"
  | "notes"
  | "approved_by"
  | "approved_at"
  | "updated_at"
  | "requires_approval"
  | "approval_status"
  | "created_at"
> {}

export class Loan
  extends Model<LoanAttributes, LoanCreationAttributes>
  implements LoanAttributes
{
  declare id: number;
  declare loan_number: string;
  declare branch_id: number;
  declare customer_name: string;
  declare customer_phone: string | null;
  declare customer_email: string | null;
  declare loan_date: Date;
  declare due_date: Date;
  declare total_amount: number;
  declare paid_amount: number;
  declare remaining_amount: number;
  declare interest_rate: number;
  declare interest_amount: number;
  declare status: LoanStatus;
  declare notes: string | null;
  declare created_by: number;
  declare approved_by: number | null;
  declare approved_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date | null;
  declare requires_approval: boolean;
  declare approval_status: ApprovalStatus;

  public static associate(models: any) {
    Loan.belongsTo(models.Branch, { foreignKey: "branch_id", as: "branch" });
    Loan.belongsTo(models.User, { foreignKey: "created_by", as: "creator" });
    Loan.belongsTo(models.User, { foreignKey: "approved_by", as: "approver" });
    Loan.hasMany(models.LoanItem, {
      foreignKey: "loan_id",
      as: "items",
      onDelete: "CASCADE",
    });
    Loan.hasMany(models.LoanPayment, {
      foreignKey: "loan_id",
      as: "payments",
      onDelete: "CASCADE",
    });
  }

  public static initModel(sequelize: Sequelize): typeof Loan {
    Loan.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        loan_number: {
          type: DataTypes.STRING(50),
          unique: true,
          allowNull: false,
        },
        branch_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "branches",
            key: "id",
          },
        },
        customer_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        customer_phone: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        customer_email: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        loan_date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
        due_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        total_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        paid_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        remaining_amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        interest_rate: {
          type: DataTypes.DECIMAL(5, 2),
          defaultValue: 0,
        },
        interest_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(LoanStatus)),
          defaultValue: LoanStatus.ACTIVE,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        approved_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
        },
        approved_at: {
          type: DataTypes.DATE,
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
        requires_approval: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        approval_status: {
          type: DataTypes.ENUM(...Object.values(ApprovalStatus)),
          defaultValue: ApprovalStatus.PENDING,
        },
      },
      {
        sequelize,
        tableName: "loans",
        timestamps: false,
        underscored: true,
      },
    );

    return Loan;
  }
}
