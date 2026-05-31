// Sale Schemas
export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED = "fixed",
}

export enum PaymentMethod {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  CHECK = "check",
  CREDIT = "credit",
  ORIGINAL_METHOD = "original_method",
}

export enum SaleStatus {
  COMPLETED = "completed",
  PENDING = "pending",
  CANCELLED = "cancelled",
}

export enum RefundStatus {
  NONE = "none",
  PARTIAL = "partial",
  FULL = "full",
}

export interface SaleItemCreate {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
}

export interface SaleItemResponse {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface SaleCreate {
  branch_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  items: SaleItemCreate[];
  tax_rate?: number;
  discount_amount?: number;
  discount_type?: DiscountType;
  shipping_cost?: number;
  payment_method?: PaymentMethod;
  bank_account_id?: number | null;
  transaction_reference?: string | null;
  notes?: string | null;
}

export interface SaleUpdate {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  notes?: string | null;
}

export interface SaleResponse {
  id: number;
  invoice_number: string;
  branch_id: number;
  branch_name?: string | null;
  user_id: number;
  user_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;

  // Financial fields
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  discount_amount: number;
  discount_type: DiscountType;
  shipping_cost: number;
  total_amount: number;
  total_cost: number;

  // Payment fields
  payment_method: PaymentMethod;
  bank_account_id?: number | null;
  bank_account_details?: any;
  transaction_reference?: string | null;

  // Status fields
  status: SaleStatus;
  refund_amount: number;
  refund_status: RefundStatus;

  // Timestamps
  created_at: Date;
  updated_at?: Date | null;
  notes?: string | null;
  items: SaleItemResponse[];
}

// Refund Schemas
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
  status: string;
  approved_by?: string | null;
  approved_at?: Date | null;

  // Timestamps
  created_at: Date;
  completed_at?: Date | null;
  notes?: string | null;
  items: RefundItemResponse[];
}

// Bank Account Schemas
export interface BankAccountBase {
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type?: string;
  currency?: string;
  is_active?: boolean;
  notes?: string | null;
}

export interface BankAccountCreate extends BankAccountBase {
  branch_id: number;
}

export interface BankAccountUpdate {
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  account_type?: string;
  currency?: string;
  is_active?: boolean;
  notes?: string | null;
}

export interface BankAccountResponse extends BankAccountBase {
  id: number;
  branch_id: number;
  branch_name?: string | null;
  created_at: Date;
  updated_at?: Date | null;
}

// Helper Functions
export function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${dateStr}-${random}`;
}

export function generateRefundNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REF-${dateStr}-${random}`;
}

// Validation Functions
export function validateSaleCreate(data: any): SaleCreate {
  if (!data.items || data.items.length === 0) {
    throw new Error("At least one item is required");
  }

  for (const item of data.items) {
    if (!item.product_id) throw new Error("Product ID is required");
    if (!item.quantity || item.quantity <= 0)
      throw new Error("Quantity must be greater than 0");
    if (!item.unit_price || item.unit_price <= 0)
      throw new Error("Unit price must be greater than 0");
  }

  if (
    data.tax_rate !== undefined &&
    (data.tax_rate < 0 || data.tax_rate > 100)
  ) {
    throw new Error("Tax rate must be between 0 and 100");
  }

  if (data.discount_amount !== undefined && data.discount_amount < 0) {
    throw new Error("Discount amount cannot be negative");
  }

  if (data.shipping_cost !== undefined && data.shipping_cost < 0) {
    throw new Error("Shipping cost cannot be negative");
  }

  if (
    data.payment_method &&
    !Object.values(PaymentMethod).includes(data.payment_method)
  ) {
    throw new Error("Invalid payment method");
  }

  if (
    data.discount_type &&
    !Object.values(DiscountType).includes(data.discount_type)
  ) {
    throw new Error("Discount type must be percentage or fixed");
  }

  return {
    branch_id: data.branch_id || null,
    customer_name: data.customer_name || null,
    customer_phone: data.customer_phone || null,
    customer_email: data.customer_email || null,
    items: data.items,
    tax_rate: data.tax_rate || 15,
    discount_amount: data.discount_amount || 0,
    discount_type: data.discount_type || DiscountType.PERCENTAGE,
    shipping_cost: data.shipping_cost || 0,
    payment_method: data.payment_method || PaymentMethod.CASH,
    bank_account_id: data.bank_account_id || null,
    transaction_reference: data.transaction_reference || null,
    notes: data.notes || null,
  };
}

export function validateSaleUpdate(data: any): SaleUpdate {
  const update: SaleUpdate = {};

  if (data.customer_name !== undefined) {
    if (data.customer_name && data.customer_name.length > 255) {
      throw new Error("Customer name must be at most 255 characters");
    }
    update.customer_name = data.customer_name;
  }
  if (data.customer_phone !== undefined) {
    if (data.customer_phone && data.customer_phone.length > 50) {
      throw new Error("Customer phone must be at most 50 characters");
    }
    update.customer_phone = data.customer_phone;
  }
  if (data.customer_email !== undefined) {
    update.customer_email = data.customer_email;
  }
  if (data.notes !== undefined) {
    update.notes = data.notes;
  }

  return update;
}

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

export function validateBankAccountCreate(data: any): BankAccountCreate {
  if (!data.branch_id) {
    throw new Error("Branch ID is required");
  }
  if (
    !data.bank_name ||
    data.bank_name.length < 1 ||
    data.bank_name.length > 100
  ) {
    throw new Error("Bank name must be between 1 and 100 characters");
  }
  if (
    !data.account_number ||
    data.account_number.length < 1 ||
    data.account_number.length > 50
  ) {
    throw new Error("Account number must be between 1 and 50 characters");
  }
  if (
    !data.account_name ||
    data.account_name.length < 1 ||
    data.account_name.length > 255
  ) {
    throw new Error("Account name must be between 1 and 255 characters");
  }

  if (
    data.account_type &&
    !["checking", "savings", "business"].includes(data.account_type)
  ) {
    throw new Error("Account type must be checking, savings, or business");
  }

  if (data.currency && data.currency.length !== 3) {
    throw new Error("Currency must be a 3-letter code");
  }

  return {
    branch_id: data.branch_id,
    bank_name: data.bank_name,
    account_number: data.account_number,
    account_name: data.account_name,
    account_type: data.account_type || "checking",
    currency: data.currency || "ETB",
    is_active: data.is_active !== undefined ? data.is_active : true,
    notes: data.notes || null,
  };
}

export function validateBankAccountUpdate(data: any): BankAccountUpdate {
  const update: BankAccountUpdate = {};

  if (data.bank_name !== undefined) {
    if (data.bank_name.length < 1 || data.bank_name.length > 100) {
      throw new Error("Bank name must be between 1 and 100 characters");
    }
    update.bank_name = data.bank_name;
  }
  if (data.account_number !== undefined) {
    if (data.account_number.length < 1 || data.account_number.length > 50) {
      throw new Error("Account number must be between 1 and 50 characters");
    }
    update.account_number = data.account_number;
  }
  if (data.account_name !== undefined) {
    if (data.account_name.length < 1 || data.account_name.length > 255) {
      throw new Error("Account name must be between 1 and 255 characters");
    }
    update.account_name = data.account_name;
  }
  if (data.account_type !== undefined) {
    if (
      data.account_type &&
      !["checking", "savings", "business"].includes(data.account_type)
    ) {
      throw new Error("Account type must be checking, savings, or business");
    }
    update.account_type = data.account_type;
  }
  if (data.currency !== undefined) {
    if (data.currency && data.currency.length !== 3) {
      throw new Error("Currency must be a 3-letter code");
    }
    update.currency = data.currency;
  }
  if (data.is_active !== undefined) {
    update.is_active = data.is_active;
  }
  if (data.notes !== undefined) {
    update.notes = data.notes;
  }

  return update;
}
