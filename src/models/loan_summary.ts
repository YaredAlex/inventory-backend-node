import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface LoanSummaryAttributes {
  id: number;
  branch_id: number;
  summary_date: Date;
  total_loans_issued: number;
  total_loan_amount: number;
  total_repayments: number;
  total_outstanding: number;
  active_loans_count: number;
  overdue_loans_count: number;
  created_at: Date;
  updated_at: Date | null;
}

interface LoanSummaryCreationAttributes extends Optional<
  LoanSummaryAttributes,
  | "id"
  | "total_loans_issued"
  | "total_loan_amount"
  | "total_repayments"
  | "total_outstanding"
  | "active_loans_count"
  | "overdue_loans_count"
  | "created_at"
  | "updated_at"
> {}

export class LoanSummary
  extends Model<LoanSummaryAttributes, LoanSummaryCreationAttributes>
  implements LoanSummaryAttributes
{
  public id!: number;
  public branch_id!: number;
  public summary_date!: Date;
  public total_loans_issued!: number;
  public total_loan_amount!: number;
  public total_repayments!: number;
  public total_outstanding!: number;
  public active_loans_count!: number;
  public overdue_loans_count!: number;
  public created_at!: Date;
  public updated_at!: Date | null;

  public static associate(models: any) {
    LoanSummary.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
  }

  public static initModel(sequelize: Sequelize): typeof LoanSummary {
    LoanSummary.init(
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
        summary_date: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        total_loans_issued: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
        total_loan_amount: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        total_repayments: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        total_outstanding: {
          type: DataTypes.DECIMAL(12, 2),
          defaultValue: 0,
        },
        active_loans_count: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
        overdue_loans_count: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
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
        tableName: "loan_summaries",
        timestamps: false,
        underscored: true,
      },
    );

    return LoanSummary;
  }
}
