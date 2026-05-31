import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export enum PaymentMethod {
  CASH = "cash",
  TICKET = "ticket",
  COUPON = "coupon",
  MIXED = "mixed",
}

interface LoanPaymentAttributes {
  id: number;
  loan_id: number;
  payment_number: string;
  payment_date: Date;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  recorded_by: number;
  sale_id: number | null;
  created_at: Date;
}

interface LoanPaymentCreationAttributes extends Optional<
  LoanPaymentAttributes,
  "id" | "reference_number" | "notes" | "sale_id" | "created_at"
> {}

export class LoanPayment
  extends Model<LoanPaymentAttributes, LoanPaymentCreationAttributes>
  implements LoanPaymentAttributes
{
  public id!: number;
  public loan_id!: number;
  public payment_number!: string;
  public payment_date!: Date;
  public amount!: number;
  public payment_method!: PaymentMethod;
  public reference_number!: string | null;
  public notes!: string | null;
  public recorded_by!: number;
  public sale_id!: number | null;
  public created_at!: Date;

  public static associate(models: any) {
    LoanPayment.belongsTo(models.Loan, { foreignKey: "loan_id", as: "loan" });
    LoanPayment.belongsTo(models.User, {
      foreignKey: "recorded_by",
      as: "recorder",
    });
    LoanPayment.belongsTo(models.Sale, { foreignKey: "sale_id", as: "sale" });
  }

  public static initModel(sequelize: Sequelize): typeof LoanPayment {
    LoanPayment.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        loan_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "loans",
            key: "id",
          },
        },
        payment_number: {
          type: DataTypes.STRING(50),
          unique: true,
          allowNull: false,
        },
        payment_date: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
        amount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
        },
        payment_method: {
          type: DataTypes.ENUM(...Object.values(PaymentMethod)),
          allowNull: false,
        },
        reference_number: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        recorded_by: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        sale_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "sales",
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
        tableName: "loan_payments",
        timestamps: false,
        underscored: true,
      },
    );

    return LoanPayment;
  }
}
