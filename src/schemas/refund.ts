import { PaymentMethod } from "./sale.js";

// Refund Item Schemas
export interface RefundItemCreate {
  sale_item_id: number;
  quantity: number;
  reason?: string | null;
}

export interface RefundItemResponse {
  id: number;
  refund_id: number;
  sale_item_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  refund_amount: number;
  reason?: string | null;
}

export interface RefundCreate {
  original_sale_id: number;
  refund_reason: string;
  refund_method?: PaymentMethod;
  bank_account_id?: number | null;
  transaction_reference?: string | null;
  items: RefundItemCreate[];
  notes?: string | null;
}

export interface RefundResponse {
  id: number;
  refund_number: string;
  original_sale_id: number;
  original_invoice_number?: string | null;
  branch_id: number;
  branch_name?: string | null;
  user_id: number;
  user_name?: string | null;
  customer_name?: string | null;

  // Refund details
  refund_amount: number;
  refund_reason: string;
  refund_method: PaymentMethod;

  // Bank transfer details
  bank_account_id?: number | null;
  bank_account_details?: any;
  transaction_reference?: string | null;

  // Status
  status: string; // pending, approved, completed, rejected
  approved_by?: string | null;
  approved_at?: Date | null;

  // Timestamps
  created_at: Date;
  completed_at?: Date | null;
  notes?: string | null;
  items: RefundItemResponse[];
}

// Validation functions
export function validateRefundCreate(data: any): RefundCreate {
  if (!data.original_sale_id) {
    throw new Error("Original sale ID is required");
  }
  if (!data.refund_reason || data.refund_reason.length === 0) {
    throw new Error("Refund reason is required");
  }
  if (!data.items || data.items.length === 0) {
    throw new Error("At least one item is required for refund");
  }

  for (const item of data.items) {
    if (!item.sale_item_id) throw new Error("Sale item ID is required");
    if (!item.quantity || item.quantity <= 0)
      throw new Error("Quantity must be greater than 0");
  }

  if (
    data.refund_method &&
    !Object.values(PaymentMethod).includes(data.refund_method)
  ) {
    throw new Error("Invalid refund method");
  }

  return {
    original_sale_id: data.original_sale_id,
    refund_reason: data.refund_reason,
    refund_method: data.refund_method || PaymentMethod.ORIGINAL_METHOD,
    bank_account_id: data.bank_account_id || null,
    transaction_reference: data.transaction_reference || null,
    items: data.items,
    notes: data.notes || null,
  };
}

export function generateRefundNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REF-${dateStr}-${random}`;
}
