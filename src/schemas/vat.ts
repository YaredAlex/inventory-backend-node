// schemas/vat.schemas.ts
import { z } from "zod";

// ==================== ENUMS ====================
export enum VATStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

// ==================== BASE SCHEMAS ====================
export const VATPurchaseBaseSchema = z.object({
  product_id: z.number().optional().nullable(),
  product_name: z.string().optional().nullable(),
  product_group: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit_cost: z.number().positive(),
  vat_rate: z.number().min(0).max(100).default(15),
  supplier_name: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  purchase_date: z.date(),
  notes: z.string().optional().nullable(),
});

export type VATPurchaseBase = z.infer<typeof VATPurchaseBaseSchema>;

// ==================== VAT PURCHASE SCHEMAS ====================
export const VATPurchaseCreateSchema = VATPurchaseBaseSchema.extend({
  purchase_order_id: z.number().optional().nullable(),
  use_wallet_payment: z.boolean().default(false),
  wallet_id: z.number().optional().nullable(),
  bank_account_id: z.number().optional().nullable(),
  payment_reference: z.string().optional().nullable(),
});

export type VATPurchaseCreate = z.infer<typeof VATPurchaseCreateSchema>;

export const VATPurchaseUpdateSchema = z.object({
  status: z.nativeEnum(VATStatus).optional(),
  notes: z.string().optional().nullable(),
  current_stock: z.number().min(0).optional(),
  sold_quantity: z.number().min(0).optional(),
  sold_value: z.number().min(0).optional(),
  sold_vat: z.number().min(0).optional(),
});

export type VATPurchaseUpdate = z.infer<typeof VATPurchaseUpdateSchema>;

export const VATPurchaseResponseSchema = VATPurchaseBaseSchema.extend({
  id: z.number(),
  vat_number: z.string(),
  branch_id: z.number(),
  branch_name: z.string().optional().nullable(),
  total_cost: z.number(),
  vat_amount: z.number(),
  total_with_vat: z.number(),
  calculated_selling_price: z.number().optional().nullable(),
  calculated_selling_price_with_vat: z.number().optional().nullable(),
  current_stock: z.number(),
  sold_quantity: z.number(),
  sold_value: z.number(),
  sold_vat: z.number(),
  current_value: z.number(),
  current_vat: z.number(),
  status: z.nativeEnum(VATStatus),
  created_at: z.date(),
  updated_at: z.date().optional().nullable(),
  created_by: z.number(),
  created_by_name: z.string().optional().nullable(),
  use_wallet_payment: z.boolean().default(false),
  wallet_id: z.number().optional().nullable(),
  wallet_name: z.string().optional().nullable(),
  wallet_transaction_id: z.number().optional().nullable(),
  bank_account_id: z.number().optional().nullable(),
  payment_reference: z.string().optional().nullable(),
});

export type VATPurchaseResponse = z.infer<typeof VATPurchaseResponseSchema>;

// ==================== VAT SALE SCHEMAS ====================
export const VATSaleBaseSchema = z.object({
  sale_id: z.number().optional().nullable(),
  sale_item_id: z.number().optional().nullable(),
  vat_purchase_id: z.number(),
  quantity: z.number().positive(),
  selling_price: z.number().positive(),
  customer_name: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type VATSaleBase = z.infer<typeof VATSaleBaseSchema>;

export const VATSaleCreateSchema = VATSaleBaseSchema;

export type VATSaleCreate = z.infer<typeof VATSaleCreateSchema>;

export const VATSaleResponseSchema = VATSaleBaseSchema.extend({
  id: z.number(),
  vat_sale_number: z.string(),
  branch_id: z.number(),
  branch_name: z.string().optional().nullable(),
  product_id: z.number().optional().nullable(),
  product_name: z.string().optional().nullable(),
  product_group: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  unit_cost: z.number(),
  selling_price_with_vat: z.number(),
  vat_rate: z.number(),
  vat_amount: z.number(),
  total_amount: z.number(),
  total_amount_with_vat: z.number(),
  cost_of_goods_sold: z.number(),
  profit: z.number(),
  profit_margin: z.number(),
  invoice_number: z.string().optional().nullable(),
  sale_date: z.date(),
  created_at: z.date(),
  created_by: z.number(),
  created_by_name: z.string().optional().nullable(),
  wallet_transaction_id: z.number().optional().nullable(),
});

export type VATSaleResponse = z.infer<typeof VATSaleResponseSchema>;

// ==================== VAT STOCK RESPONSE SCHEMA ====================
export const VATPurchaseStockResponseSchema = z.object({
  id: z.number(),
  vat_number: z.string(),
  product_id: z.number().optional().nullable(),
  product_name: z.string().optional().nullable(),
  product_group: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  current_stock: z.number(),
  unit_cost: z.number(),
  current_value: z.number(),
  purchase_date: z.date(),
  supplier_name: z.string().optional().nullable(),
});

export type VATPurchaseStockResponse = z.infer<
  typeof VATPurchaseStockResponseSchema
>;

// ==================== VAT SUMMARY SCHEMAS ====================
export const VATSummaryBaseSchema = z.object({
  summary_month: z.string(),
  total_purchases_excl_vat: z.number().default(0),
  total_purchase_vat: z.number().default(0),
  total_purchases_incl_vat: z.number().default(0),
  purchase_count: z.number().int().min(0).default(0),
  purchase_by_group: z.record(z.number(), z.any()).optional().nullable(),
  total_sales_excl_vat: z.number().default(0),
  total_sale_vat: z.number().default(0),
  total_sales_incl_vat: z.number().default(0),
  sale_count: z.number().int().min(0).default(0),
  sale_by_group: z.record(z.number(), z.any()).optional().nullable(),
  vat_payable: z.number().default(0),
  vat_receivable: z.number().default(0),
  net_vat: z.number().default(0),
  total_profit_excl_vat: z.number().default(0),
  average_profit_margin: z.number().default(0),
});

export type VATSummaryBase = z.infer<typeof VATSummaryBaseSchema>;

export const VATSummaryCreateSchema = VATSummaryBaseSchema.extend({
  branch_id: z.number(),
  summary_year: z.number().int(),
  summary_month_num: z.number().int().min(1).max(12),
});

export type VATSummaryCreate = z.infer<typeof VATSummaryCreateSchema>;

export const VATSummaryUpdateSchema = z.object({
  status: z.nativeEnum(VATStatus).optional(),
  filed_date: z.date().optional().nullable(),
  payment_date: z.date().optional().nullable(),
  payment_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type VATSummaryUpdate = z.infer<typeof VATSummaryUpdateSchema>;

export const VATSummaryResponseSchema = VATSummaryBaseSchema.extend({
  id: z.number(),
  branch_id: z.number(),
  branch_name: z.string().optional().nullable(),
  summary_year: z.number(),
  summary_month_num: z.number(),
  status: z.nativeEnum(VATStatus),
  filed_date: z.date().optional().nullable(),
  payment_date: z.date().optional().nullable(),
  payment_reference: z.string().optional().nullable(),
  created_at: z.date(),
  updated_at: z.date().optional().nullable(),
  created_by: z.number().optional().nullable(),
});

export type VATSummaryResponse = z.infer<typeof VATSummaryResponseSchema>;

// ==================== VAT RATE HISTORY SCHEMAS ====================
export const VATRateHistoryBaseSchema = z.object({
  vat_rate: z.number().min(0).max(100),
  effective_from: z.date(),
  effective_to: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type VATRateHistoryBase = z.infer<typeof VATRateHistoryBaseSchema>;

export const VATRateHistoryCreateSchema = VATRateHistoryBaseSchema;

export type VATRateHistoryCreate = z.infer<typeof VATRateHistoryCreateSchema>;

export const VATRateHistoryResponseSchema = VATRateHistoryBaseSchema.extend({
  id: z.number(),
  created_by: z.number(),
  created_at: z.date(),
});

export type VATRateHistoryResponse = z.infer<
  typeof VATRateHistoryResponseSchema
>;

// ==================== REPORT SCHEMAS ====================
export const VATPeriodReportSchema = z.object({
  period_start: z.date(),
  period_end: z.date(),
  branch_id: z.number().optional().nullable(),
  branch_name: z.string().optional().nullable(),
  total_purchases: z.number(),
  total_purchase_vat: z.number(),
  purchases_by_group: z.record(z.number(), z.any()),
  total_sales: z.number(),
  total_sale_vat: z.number(),
  sales_by_group: z.record(z.number(), z.any()),
  vat_payable: z.number(),
  vat_receivable: z.number(),
  net_vat_due: z.number(),
  gross_profit: z.number(),
  profit_margin: z.number(),
  purchase_transactions: z.array(VATPurchaseResponseSchema).default([]),
  sale_transactions: z.array(VATSaleResponseSchema).default([]),
});

export type VATPeriodReport = z.infer<typeof VATPeriodReportSchema>;

export const VATProductGroupReportSchema = z.object({
  product_group: z.string(),
  total_purchases_excl_vat: z.number(),
  total_purchase_vat: z.number(),
  total_sales_excl_vat: z.number(),
  total_sale_vat: z.number(),
  vat_contribution: z.number(),
  profit: z.number(),
  profit_margin: z.number(),
  quantity_purchased: z.number(),
  quantity_sold: z.number(),
});

export type VATProductGroupReport = z.infer<typeof VATProductGroupReportSchema>;

export const VATDashboardSummarySchema = z.object({
  current_month_summary: VATSummaryResponseSchema.optional().nullable(),
  previous_month_summary: VATSummaryResponseSchema.optional().nullable(),
  year_to_date_purchases: z.number(),
  year_to_date_sales: z.number(),
  year_to_date_vat_payable: z.number(),
  pending_vat_returns: z.number().int().min(0),
  current_vat_rate: z.number(),
  vat_rate_history: z.array(VATRateHistoryResponseSchema).default([]),
  top_product_groups_by_vat: z.array(VATProductGroupReportSchema).default([]),
});

export type VATDashboardSummary = z.infer<typeof VATDashboardSummarySchema>;

// ==================== HELPER FUNCTIONS ====================
export function validateVATPurchaseCreate(data: unknown): VATPurchaseCreate {
  return VATPurchaseCreateSchema.parse(data);
}

export function validateVATPurchaseUpdate(data: unknown): VATPurchaseUpdate {
  return VATPurchaseUpdateSchema.parse(data);
}

export function validateVATPurchaseResponse(
  data: unknown,
): VATPurchaseResponse {
  return VATPurchaseResponseSchema.parse(data);
}

export function validateVATSaleCreate(data: unknown): VATSaleCreate {
  return VATSaleCreateSchema.parse(data);
}

export function validateVATSaleResponse(data: unknown): VATSaleResponse {
  return VATSaleResponseSchema.parse(data);
}

export function validateVATSummaryCreate(data: unknown): VATSummaryCreate {
  return VATSummaryCreateSchema.parse(data);
}

export function validateVATSummaryUpdate(data: unknown): VATSummaryUpdate {
  return VATSummaryUpdateSchema.parse(data);
}

export function validateVATSummaryResponse(data: unknown): VATSummaryResponse {
  return VATSummaryResponseSchema.parse(data);
}

export function validateVATRateHistoryCreate(
  data: unknown,
): VATRateHistoryCreate {
  return VATRateHistoryCreateSchema.parse(data);
}

export function validateVATRateHistoryResponse(
  data: unknown,
): VATRateHistoryResponse {
  return VATRateHistoryResponseSchema.parse(data);
}

export function validateVATPeriodReport(data: unknown): VATPeriodReport {
  return VATPeriodReportSchema.parse(data);
}

export function validateVATProductGroupReport(
  data: unknown,
): VATProductGroupReport {
  return VATProductGroupReportSchema.parse(data);
}

export function validateVATDashboardSummary(
  data: unknown,
): VATDashboardSummary {
  return VATDashboardSummarySchema.parse(data);
}

// ==================== UTILITY FUNCTIONS ====================
export function calculateVATAmount(
  amount: number,
  vatRate: number = 15.0,
): {
  excl_vat: number;
  vat_amount: number;
  incl_vat: number;
  vat_rate: number;
} {
  const vatAmount = amount * (vatRate / 100);
  const totalWithVAT = amount + vatAmount;
  return {
    excl_vat: parseFloat(amount.toFixed(2)),
    vat_amount: parseFloat(vatAmount.toFixed(2)),
    incl_vat: parseFloat(totalWithVAT.toFixed(2)),
    vat_rate: vatRate,
  };
}

export function calculateSellingPrice(
  unitCost: number,
  markupPercentage: number = 15.0,
  vatRate: number = 15.0,
): {
  unit_cost: number;
  markup_percentage: number;
  selling_price_excl_vat: number;
  vat_rate: number;
  vat_amount: number;
  selling_price_incl_vat: number;
  profit_per_unit: number;
  profit_margin: number;
} {
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

export function calculateCOGSAndProfit(
  quantity: number,
  unitCost: number,
  sellingPriceExclVAT: number,
): {
  quantity: number;
  cogs: number;
  total_revenue: number;
  profit: number;
  profit_margin: number;
} {
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
