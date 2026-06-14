import { Decimal } from "decimal.js";

// ==================== VAT CALCULATION FUNCTIONS ====================

export interface VATCalculationResult {
  excl_vat: number;
  vat_amount: number;
  incl_vat: number;
  vat_rate: number;
}

export function calculateVATAmount(
  amount: number,
  vatRate: number = 15.0,
): VATCalculationResult {
  const vatAmount = amount * (vatRate / 100);
  const totalWithVAT = amount + vatAmount;

  return {
    excl_vat: parseFloat(amount.toFixed(2)),
    vat_amount: parseFloat(vatAmount.toFixed(2)),
    incl_vat: parseFloat(totalWithVAT.toFixed(2)),
    vat_rate: vatRate,
  };
}

export interface SellingPriceResult {
  unit_cost: number;
  markup_percentage: number;
  selling_price_excl_vat: number;
  vat_rate: number;
  vat_amount: number;
  selling_price_incl_vat: number;
  profit_per_unit: number;
  profit_margin: number;
}

export function calculateSellingPrice(
  unitCost: number,
  markupPercentage: number = 15.0,
  vatRate: number = 15.0,
): SellingPriceResult {
  if (markupPercentage <= 0 || markupPercentage >= 100) {
    markupPercentage = 15.0;
  }

  const sellingPriceExclVAT = unitCost / (1 - markupPercentage / 100);
  const vatAmount = sellingPriceExclVAT * (vatRate / 100);
  const sellingPriceInclVAT = sellingPriceExclVAT + vatAmount;

  return {
    unit_cost: parseFloat(unitCost.toFixed(2)),
    markup_percentage: markupPercentage,
    selling_price_excl_vat: parseFloat(sellingPriceExclVAT.toFixed(2)),
    vat_rate: vatRate,
    vat_amount: parseFloat(vatAmount.toFixed(2)),
    selling_price_incl_vat: parseFloat(sellingPriceInclVAT.toFixed(2)),
    profit_per_unit: parseFloat((sellingPriceExclVAT - unitCost).toFixed(2)),
    profit_margin: parseFloat(
      (((sellingPriceExclVAT - unitCost) / sellingPriceExclVAT) * 100).toFixed(
        2,
      ),
    ),
  };
}

export interface COGSAndProfitResult {
  quantity: number;
  cogs: number;
  total_revenue: number;
  profit: number;
  profit_margin: number;
}

export function calculateCOGSAndProfit(
  quantity: number,
  unitCost: number,
  sellingPriceExclVAT: number,
): COGSAndProfitResult {
  const cogs = quantity * unitCost;
  const totalRevenue = quantity * sellingPriceExclVAT;
  const profit = totalRevenue - cogs;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    quantity: quantity,
    cogs: parseFloat(cogs.toFixed(2)),
    total_revenue: parseFloat(totalRevenue.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    profit_margin: parseFloat(profitMargin.toFixed(2)),
  };
}
