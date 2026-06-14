// models/VATSummary.ts
import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { VATStatus } from "./vat_purchase.js";

export interface VATSummaryAttributes {
  id: number;
  branch_id: number;
  summary_month: string;
  summary_year: number;
  summary_month_num: number;
  total_purchases_excl_vat: number;
  total_purchase_vat: number;
  total_purchases_incl_vat: number;
  purchase_count: number;
  purchase_by_group: string | null;
  total_sales_excl_vat: number;
  total_sale_vat: number;
  total_sales_incl_vat: number;
  sale_count: number;
  sale_by_group: string | null;
  vat_payable: number;
  vat_receivable: number;
  net_vat: number;
  total_profit_excl_vat: number;
  average_profit_margin: number;
  status: string;
  filed_date: Date | null;
  payment_date: Date | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

// Include all fields that have defaults or can be null in Optional
interface VATSummaryCreationAttributes extends Optional<
  VATSummaryAttributes,
  | "id"
  | "created_at"
  | "updated_at"
  | "total_purchases_excl_vat"
  | "total_purchase_vat"
  | "total_purchases_incl_vat"
  | "purchase_count"
  | "purchase_by_group"
  | "total_sales_excl_vat"
  | "total_sale_vat"
  | "total_sales_incl_vat"
  | "sale_count"
  | "sale_by_group"
  | "vat_payable"
  | "vat_receivable"
  | "net_vat"
  | "total_profit_excl_vat"
  | "average_profit_margin"
  | "status"
  | "filed_date"
  | "payment_date"
  | "payment_reference"
  | "notes"
  | "created_by"
> {}

export class VATSummary
  extends Model<VATSummaryAttributes, VATSummaryCreationAttributes>
  implements VATSummaryAttributes
{
  declare id: number;
  declare branch_id: number;
  declare summary_month: string;
  declare summary_year: number;
  declare summary_month_num: number;
  declare total_purchases_excl_vat: number;
  declare total_purchase_vat: number;
  declare total_purchases_incl_vat: number;
  declare purchase_count: number;
  declare purchase_by_group: string | null;
  declare total_sales_excl_vat: number;
  declare total_sale_vat: number;
  declare total_sales_incl_vat: number;
  declare sale_count: number;
  declare sale_by_group: string | null;
  declare vat_payable: number;
  declare vat_receivable: number;
  declare net_vat: number;
  declare total_profit_excl_vat: number;
  declare average_profit_margin: number;
  declare status: string;
  declare filed_date: Date | null;
  declare payment_date: Date | null;
  declare payment_reference: string | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare created_by: number | null;

  // Associations
  public static associate(models: any) {
    VATSummary.belongsTo(models.Branch, {
      foreignKey: "branch_id",
      as: "branch",
    });

    VATSummary.belongsTo(models.User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }

  public static initModel(sequelize: Sequelize): typeof VATSummary {
    VATSummary.init(
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
        summary_month: {
          type: DataTypes.STRING(7),
          allowNull: false,
        },
        summary_year: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 2000,
            max: 2100,
          },
        },
        summary_month_num: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 1,
            max: 12,
          },
        },
        total_purchases_excl_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_purchase_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_purchases_incl_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        purchase_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0,
          },
        },
        purchase_by_group: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        total_sales_excl_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_sale_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        total_sales_incl_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        sale_count: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: {
            min: 0,
          },
        },
        sale_by_group: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        vat_payable: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        vat_receivable: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        net_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
          },
        },
        total_profit_excl_vat: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
          },
        },
        average_profit_margin: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 0,
          validate: {
            isDecimal: true,
            min: 0,
            max: 100,
          },
        },
        status: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: VATStatus.PENDING,
          validate: {
            isIn: [Object.values(VATStatus)],
          },
        },
        filed_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        payment_date: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        payment_reference: {
          type: DataTypes.STRING(100),
          allowNull: true,
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
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        created_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
        },
      },
      {
        sequelize,
        tableName: "vat_summaries",
        timestamps: true,
        underscored: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        indexes: [
          {
            name: "unique_branch_month",
            unique: true,
            fields: ["branch_id", "summary_month"],
          },
          {
            name: "idx_vat_summary_month",
            fields: ["summary_month"],
          },
          {
            name: "idx_vat_summary_status",
            fields: ["status"],
          },
          {
            name: "idx_vat_summary_branch",
            fields: ["branch_id"],
          },
          {
            name: "idx_vat_summary_year",
            fields: ["summary_year"],
          },
          {
            name: "idx_vat_summary_month_num",
            fields: ["summary_month_num"],
          },
        ],
      },
    );

    return VATSummary;
  }
}

// Helper function to generate summary month string (YYYY-MM)
export function getSummaryMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Helper function to get summary year and month numbers from date
export function getSummaryYearMonth(date: Date): {
  year: number;
  monthNum: number;
  month: string;
} {
  const year = date.getFullYear();
  const monthNum = date.getMonth() + 1;
  const month = String(monthNum).padStart(2, "0");
  return {
    year,
    monthNum,
    month: `${year}-${month}`,
  };
}

// Helper function to calculate VAT summary from purchases and sales
export async function calculateVATSummary(
  sequelize: Sequelize,
  branchId: number,
  year: number,
  monthNum: number,
): Promise<Partial<VATSummaryAttributes>> {
  const { Op } = require("sequelize");

  // Calculate date range for the month
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);

  // Get VAT purchases for the month
  const VATPurchase = require("./VATPurchase").VATPurchase;
  const VATSale = require("./VATSale").VATSale;

  const purchases = await VATPurchase.findAll({
    where: {
      branch_id: branchId,
      purchase_date: {
        [Op.between]: [startDate, endDate],
      },
      status: {
        [Op.in]: [VATStatus.APPROVED, VATStatus.COMPLETED],
      },
    },
  });

  // Get VAT sales for the month
  const sales = await VATSale.findAll({
    where: {
      branch_id: branchId,
      sale_date: {
        [Op.between]: [startDate, endDate],
      },
    },
  });

  // Calculate purchase totals
  let totalPurchasesExclVAT = 0;
  let totalPurchaseVAT = 0;
  let purchaseCount = purchases.length;
  const purchaseByGroup: Record<string, number> = {};

  purchases.forEach((purchase: any) => {
    totalPurchasesExclVAT += parseFloat(purchase.total_cost);
    totalPurchaseVAT += parseFloat(purchase.vat_amount);

    const group = purchase.product_group || "uncategorized";
    purchaseByGroup[group] =
      (purchaseByGroup[group] || 0) + parseFloat(purchase.total_cost);
  });

  // Calculate sales totals
  let totalSalesExclVAT = 0;
  let totalSaleVAT = 0;
  let saleCount = sales.length;
  let totalProfitExclVAT = 0;
  let totalProfitMargin = 0;
  const saleByGroup: Record<string, number> = {};

  sales.forEach((sale: any) => {
    totalSalesExclVAT += parseFloat(sale.total_amount);
    totalSaleVAT += parseFloat(sale.vat_amount);
    totalProfitExclVAT += parseFloat(sale.profit);
    totalProfitMargin += parseFloat(sale.profit_margin);

    const group = sale.product_group || "uncategorized";
    saleByGroup[group] =
      (saleByGroup[group] || 0) + parseFloat(sale.total_amount);
  });

  const totalPurchasesInclVAT = totalPurchasesExclVAT + totalPurchaseVAT;
  const totalSalesInclVAT = totalSalesExclVAT + totalSaleVAT;

  // Calculate VAT payable/receivable
  // VAT payable is VAT collected on sales
  // VAT receivable is VAT paid on purchases that can be claimed back
  const vatPayable = totalSaleVAT;
  const vatReceivable = totalPurchaseVAT;
  const netVAT = vatPayable - vatReceivable;

  const averageProfitMargin = saleCount > 0 ? totalProfitMargin / saleCount : 0;

  return {
    summary_month: getSummaryMonth(startDate),
    summary_year: year,
    summary_month_num: monthNum,
    total_purchases_excl_vat: totalPurchasesExclVAT,
    total_purchase_vat: totalPurchaseVAT,
    total_purchases_incl_vat: totalPurchasesInclVAT,
    purchase_count: purchaseCount,
    purchase_by_group: JSON.stringify(purchaseByGroup),
    total_sales_excl_vat: totalSalesExclVAT,
    total_sale_vat: totalSaleVAT,
    total_sales_incl_vat: totalSalesInclVAT,
    sale_count: saleCount,
    sale_by_group: JSON.stringify(saleByGroup),
    vat_payable: vatPayable,
    vat_receivable: vatReceivable,
    net_vat: netVAT,
    total_profit_excl_vat: totalProfitExclVAT,
    average_profit_margin: averageProfitMargin,
  };
}
