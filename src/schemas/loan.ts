// Loan Schemas
export enum LoanStatus {
  ACTIVE = "active",
  PARTIALLY_PAID = "partially_paid",
  SETTLED = "settled",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

export enum LoanPaymentMethod {
  CASH = "cash",
  TICKET = "ticket",
  COUPON = "coupon",
  MIXED = "mixed",
}

export interface LoanItemCreate {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface LoanItemResponse {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface LoanBase {
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  due_date: Date;
  interest_rate: number;
  notes?: string | null;
}

export interface LoanCreate extends LoanBase {
  items: LoanItemCreate[];
}

export interface LoanUpdate {
  due_date?: Date | null;
  interest_rate?: number;
  status?: LoanStatus;
  notes?: string | null;
}

export interface LoanResponse extends LoanBase {
  id: number;
  loan_number: string;
  branch_id: number;
  loan_date: Date;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  interest_amount: number;
  status: LoanStatus;
  items: LoanItemResponse[];
  payments: LoanPaymentResponse[];
  created_by: string;
  approved_by?: string | null;
  approved_at?: Date | null;
  created_at: Date;
  updated_at?: Date | null;
}

// Loan Payment Schemas
export interface LoanPaymentBase {
  amount: number;
  payment_method: LoanPaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

export interface LoanPaymentCreate extends LoanPaymentBase {
  sale_id?: number | null;
}

export interface LoanPaymentResponse extends LoanPaymentBase {
  id: number;
  payment_number: string;
  payment_date: Date;
  recorded_by: string;
  sale_id?: number | null;
  created_at: Date;
}

export interface LoanSettleRequest {
  amount: number;
  payment_method: LoanPaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

// Helper functions
export function generateLoanNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LN-${dateStr}-${random}`;
}

export function generatePaymentNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PMT-${dateStr}-${random}`;
}
