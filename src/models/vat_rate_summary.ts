// models/VATRateHistory.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export interface VATRateHistoryAttributes {
  id: number;
  vat_rate: number;
  effective_from: Date;
  effective_to: Date | null;
  created_by: number;
  notes: string | null;
  created_at: Date;
}

// Include all fields that have defaults or can be null in Optional
interface VATRateHistoryCreationAttributes extends Optional<
  VATRateHistoryAttributes,
  "id" | "created_at" | "effective_to" | "notes"
> {}

export class VATRateHistory
  extends Model<VATRateHistoryAttributes, VATRateHistoryCreationAttributes>
  implements VATRateHistoryAttributes
{
  declare id: number;
  declare vat_rate: number;
  declare effective_from: Date;
  declare effective_to: Date | null;
  declare created_by: number;
  declare notes: string | null;
  declare created_at: Date;

  // Associations
  public static associate(models: any) {
    VATRateHistory.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }

  public static initModel(sequelize: Sequelize): typeof VATRateHistory {
    VATRateHistory.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        vat_rate: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          validate: {
            isDecimal: true,
            min: 0,
            max: 100,
          },
        },
        effective_from: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        effective_to: {
          type: DataTypes.DATE,
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
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "vat_rate_histories",
        timestamps: false,
        underscored: true,
        indexes: [
          {
            name: "idx_vat_rate_effective",
            fields: ["effective_from", "effective_to"],
          },
          {
            name: "idx_vat_rate_created_by",
            fields: ["created_by"],
          },
          {
            name: "idx_vat_rate_value",
            fields: ["vat_rate"],
          },
        ],
      },
    );

    return VATRateHistory;
  }
}

// Helper function to get the current VAT rate based on date
export async function getCurrentVATRate(
  sequelize: Sequelize,
  date: Date = new Date(),
): Promise<number> {
  const { Op } = require("sequelize");

  const rateHistory = await VATRateHistory.findOne({
    where: {
      effective_from: {
        [Op.lte]: date,
      },
      [Op.or]: [
        {
          effective_to: {
            [Op.gte]: date,
          },
        },
        {
          effective_to: null,
        },
      ],
    },
    order: [["effective_from", "DESC"]],
  });

  if (rateHistory) {
    return parseFloat(rateHistory.vat_rate as any);
  }

  // Return default VAT rate if no history found
  return 15.0;
}

// Helper function to get VAT rate for a specific date
export async function getVATRateForDate(
  sequelize: Sequelize,
  date: Date,
): Promise<number | null> {
  const { Op } = require("sequelize");

  const rateHistory = await VATRateHistory.findOne({
    where: {
      effective_from: {
        [Op.lte]: date,
      },
      [Op.or]: [
        {
          effective_to: {
            [Op.gte]: date,
          },
        },
        {
          effective_to: null,
        },
      ],
    },
    order: [["effective_from", "DESC"]],
  });

  if (rateHistory) {
    return parseFloat(rateHistory.vat_rate as any);
  }

  return null;
}

// Helper function to create a new VAT rate
export async function createVATRate(
  sequelize: Sequelize,
  vatRate: number,
  effectiveFrom: Date,
  createdBy: number,
  notes?: string,
): Promise<VATRateHistory> {
  const transaction = await sequelize.transaction();

  try {
    // Check if there's an existing rate that hasn't ended
    const { Op } = require("sequelize");
    const existingRate = await VATRateHistory.findOne({
      where: {
        effective_to: null,
      },
      transaction,
    });

    // If there's an existing rate, end it before the new effective date
    if (existingRate) {
      const endDate = new Date(effectiveFrom);
      endDate.setDate(endDate.getDate() - 1);
      existingRate.effective_to = endDate;
      await existingRate.save({ transaction });
    }

    // Create the new rate
    const newRate = await VATRateHistory.create(
      {
        vat_rate: vatRate,
        effective_from: effectiveFrom,
        effective_to: null,
        created_by: createdBy,
        notes: notes || null,
      },
      { transaction },
    );

    await transaction.commit();
    return newRate;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Helper function to get VAT rate history for a date range
export async function getVATRateHistoryForPeriod(
  sequelize: Sequelize,
  startDate: Date,
  endDate: Date,
): Promise<VATRateHistory[]> {
  const { Op } = require("sequelize");

  const rateHistory = await VATRateHistory.findAll({
    where: {
      effective_from: {
        [Op.lte]: endDate,
      },
      [Op.or]: [
        {
          effective_to: {
            [Op.gte]: startDate,
          },
        },
        {
          effective_to: null,
        },
      ],
    },
    order: [["effective_from", "ASC"]],
  });

  return rateHistory;
}

// Helper function to calculate VAT for a given amount based on date
export async function calculateVATForAmount(
  sequelize: Sequelize,
  amount: number,
  date: Date,
): Promise<{ vatAmount: number; totalWithVAT: number; vatRate: number }> {
  const vatRate = await getCurrentVATRate(sequelize, date);
  const vatAmount = amount * (vatRate / 100);
  const totalWithVAT = amount + vatAmount;

  return {
    vatRate,
    vatAmount,
    totalWithVAT,
  };
}
