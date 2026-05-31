import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface BankAccountAttributes {
  id: number;
  branch_id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: string;
  currency: string;
  is_active: boolean;
  notes?: string | null;
  created_at: Date;
  updated_at: Date | null;
}

interface BankAccountCreationAttributes extends Optional<
  BankAccountAttributes,
  | "id"
  | "account_type"
  | "currency"
  | "is_active"
  | "notes"
  | "created_at"
  | "updated_at"
> {}

export class BankAccount
  extends Model<BankAccountAttributes, BankAccountCreationAttributes>
  implements BankAccountAttributes
{
  declare id: number;
  declare branch_id: number;
  declare bank_name: string;
  declare account_number: string;
  declare account_name: string;
  declare account_type: string;
  declare currency: string;
  declare is_active: boolean;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date | null;

  public static associate(models: any) {
    BankAccount.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });
    BankAccount.hasMany(models.Sale, {
      foreignKey: "bank_account_id",
      as: "sales",
    });
    BankAccount.hasMany(models.Refund, {
      foreignKey: "bank_account_id",
      as: "refunds",
    });
  }

  public static initModel(sequelize: Sequelize): typeof BankAccount {
    BankAccount.init(
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
        bank_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        account_number: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        account_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        account_type: {
          type: DataTypes.STRING(50),
          defaultValue: "checking",
        },
        currency: {
          type: DataTypes.STRING(3),
          defaultValue: "ETB",
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
        },
        notes: {
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
        tableName: "bank_accounts",
        timestamps: false,
        underscored: true,
      },
    );

    return BankAccount;
  }
}
