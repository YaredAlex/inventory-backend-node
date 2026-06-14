// schemas/wallet.schemas.ts

// ==================== WALLET ENUMS ====================
export enum WalletTransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  PURCHASE = "purchase",
  RESTOCK = "restock",
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
  TRANSFER = "transfer",
}

export enum WalletTransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
}

export enum WalletType {
  VAT = "vat",
  REGULAR = "regular",
  PETTY_CASH = "petty_cash",
  EXPENSE = "expense",
  CUSTOM = "custom",
}

export enum WalletPurpose {
  VAT_OPERATIONS = "vat_operations",
  REGULAR_STOCK = "regular_stock",
  PETTY_CASH = "petty_cash",
  OPERATING_EXPENSES = "operating_expenses",
  MARKETING = "marketing",
  MAINTENANCE = "maintenance",
  OTHER = "other",
}

export enum WalletTransactionMethod {
  CASH = "cash",
  BANK_TRANSFER = "bank_transfer",
  CHEQUE = "cheque",
  CARD = "card",
  MOBILE_MONEY = "mobile_money",
  INTERNAL_TRANSFER = "internal_transfer",
}

// ==================== WALLET SCHEMAS ====================
// schemas/wallet.schemas.ts - Updated WalletCreate interface

export interface WalletCreate {
  wallet_name: string;
  branch_id: number;
  wallet_type: WalletType;
  wallet_purpose?: WalletPurpose;
  currency?: string;
  description?: string | null;
  created_by?: number | null;
  // Additional attributes
  bank_account_id?: number | null;
  initial_balance?: number;
  requires_approval?: boolean;
  max_balance?: number | null;
  min_balance?: number | null;
  daily_limit?: number | null;
  transaction_limit?: number | null;
}

export interface WalletUpdate {
  wallet_name?: string;
  is_active?: boolean;
  requires_approval?: boolean;
  max_balance?: number | null;
  min_balance?: number | null;
  daily_limit?: number | null;
  transaction_limit?: number | null;
  description?: string | null;
}

export interface WalletResponse {
  id: number;
  wallet_number: string;
  wallet_name: string;
  branch_id: number;
  wallet_type: WalletType;
  wallet_purpose: WalletPurpose;
  balance: number;
  currency: string;
  bank_account_id: number | null;
  is_active: boolean;
  requires_approval: boolean;
  max_balance: number | null;
  min_balance: number | null;
  daily_limit: number | null;
  transaction_limit: number | null;
  description: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  branch_name: string | null;
}

export interface WalletBalanceResponse {
  wallet_id: number;
  wallet_name: string;
  wallet_type: string;
  balance: number;
  currency: string;
  bank_account_name: string | null;
  last_transaction_at: Date | null;
}

export interface WalletTransactionCreate {
  wallet_id: number;
  transaction_type: WalletTransactionType;
  amount: number;
  description: string;
  transaction_method?: WalletTransactionMethod;
  reference_type?: string | null;
  reference_id?: number | null;
  reference_number?: string | null;
  bank_reference?: string | null;
  from_wallet_id?: number | null;
  to_wallet_id?: number | null;
}

export interface WalletTransactionResponse {
  id: number;
  transaction_number: string;
  wallet_id: number;
  wallet_name?: string | null;
  transaction_type: WalletTransactionType;
  transaction_method: WalletTransactionMethod;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: WalletTransactionStatus;
  approval_status: string;
  description: string;
  reference_type: string | null;
  reference_id: number | null;
  reference_number: string | null;
  bank_reference: string | null;
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  created_by: number;
  created_by_name?: string | null;
  created_at: Date;
  approved_by?: string | null;
  approved_at?: Date | null;
}

export interface WalletSummaryResponse {
  id: number;
  wallet_id: number;
  wallet_name?: string | null;
  branch_id: number;
  branch_name?: string | null;
  summary_date: Date;
  opening_balance: number;
  total_deposits: number;
  total_transfers_in: number;
  total_income: number;
  total_withdrawals: number;
  total_transfers_out: number;
  total_purchases: number;
  total_restocks: number;
  total_refunds: number;
  total_expenses: number;
  closing_balance: number;
  transaction_count: number;
  average_transaction_amount: number;
  highest_transaction: number;
  lowest_transaction: number;
  bank_balance_at_date: number | null;
  is_reconciled: boolean;
  reconciled_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
  notes: string | null;
}

export interface WalletTransfer {
  from_wallet_id: number;
  to_wallet_id: number;
  amount: number;
  transaction_method: WalletTransactionMethod;
  description?: string | null;
  notes?: string | null;
}

export interface WalletWithdrawal {
  wallet_id: number;
  amount: number;
  description: string;
  transaction_method?: WalletTransactionMethod;
  bank_account_id?: number | null;
  reference_type?: string | null;
  reference_id?: number | null;
  reference_number?: string | null;
  notes?: string | null;
  bank_reference?: string | null;
}

export interface WalletDeposit {
  wallet_id: number;
  amount: number;
  description: string;
  transaction_method?: WalletTransactionMethod;
  bank_account_id?: number | null;
  reference_type?: string | null;
  reference_id?: number | null;
  reference_number?: string | null;
  notes?: string | null;
  bank_reference?: string | null;
}

export interface WalletPerformanceReport {
  period_start: Date;
  period_end: Date;
  wallet_id: number | null;
  wallet_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  opening_balance: number;
  closing_balance: number;
  net_change: number;
  total_deposits: number;
  total_withdrawals: number;
  total_transfers_in: number;
  total_transfers_out: number;
  total_purchases: number;
  total_restocks: number;
  total_refunds: number;
  transaction_count: number;
  average_transaction_size: number;
  largest_deposit: number;
  largest_withdrawal: number;
  daily_balances: Array<Record<string, any>>;
  transaction_history: WalletTransactionResponse[];
}

export interface BranchWalletSummaryResponse {
  branch_id: number;
  branch_name: string;
  wallets: WalletBalanceResponse[];
  total_balance: number;
}

// ==================== VALIDATION FUNCTIONS ====================

export function validateWalletCreate(data: any): WalletCreate {
  if (!data.wallet_name) {
    throw new Error("Wallet name is required");
  }
  if (!data.branch_id) {
    throw new Error("Branch ID is required");
  }
  if (
    !data.wallet_type ||
    !Object.values(WalletType).includes(data.wallet_type)
  ) {
    throw new Error("Valid wallet type is required");
  }

  return {
    wallet_name: data.wallet_name,
    branch_id: data.branch_id,
    wallet_type: data.wallet_type,
    wallet_purpose: data.wallet_purpose || WalletPurpose.OTHER,
    currency: data.currency || "ETB",
    description: data.description || null,
  };
}

export function validateWalletUpdate(data: any): WalletUpdate {
  const update: WalletUpdate = {};

  if (data.wallet_name !== undefined) {
    if (
      typeof data.wallet_name !== "string" ||
      data.wallet_name.length < 1 ||
      data.wallet_name.length > 100
    ) {
      throw new Error("Wallet name must be between 1 and 100 characters");
    }
    update.wallet_name = data.wallet_name;
  }
  if (data.is_active !== undefined) {
    update.is_active = data.is_active;
  }
  if (data.requires_approval !== undefined) {
    update.requires_approval = data.requires_approval;
  }
  if (data.max_balance !== undefined) {
    if (data.max_balance !== null && data.max_balance < 0) {
      throw new Error("Max balance cannot be negative");
    }
    update.max_balance = data.max_balance;
  }
  if (data.min_balance !== undefined) {
    if (data.min_balance !== null && data.min_balance < 0) {
      throw new Error("Min balance cannot be negative");
    }
    update.min_balance = data.min_balance;
  }
  if (data.daily_limit !== undefined) {
    if (data.daily_limit !== null && data.daily_limit < 0) {
      throw new Error("Daily limit cannot be negative");
    }
    update.daily_limit = data.daily_limit;
  }
  if (data.transaction_limit !== undefined) {
    if (data.transaction_limit !== null && data.transaction_limit < 0) {
      throw new Error("Transaction limit cannot be negative");
    }
    update.transaction_limit = data.transaction_limit;
  }
  if (data.description !== undefined) {
    update.description = data.description;
  }

  return update;
}

export function validateWalletTransactionCreate(
  data: any,
): WalletTransactionCreate {
  if (!data.wallet_id) {
    throw new Error("Wallet ID is required");
  }
  if (
    !data.transaction_type ||
    !Object.values(WalletTransactionType).includes(data.transaction_type)
  ) {
    throw new Error("Valid transaction type is required");
  }
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (!data.description) {
    throw new Error("Description is required");
  }

  return {
    wallet_id: data.wallet_id,
    transaction_type: data.transaction_type,
    amount: data.amount,
    description: data.description,
    transaction_method: data.transaction_method || WalletTransactionMethod.CASH,
    reference_type: data.reference_type || null,
    reference_id: data.reference_id || null,
    reference_number: data.reference_number || null,
    bank_reference: data.bank_reference || null,
    from_wallet_id: data.from_wallet_id || null,
    to_wallet_id: data.to_wallet_id || null,
  };
}

export function validateWalletTransfer(data: any): WalletTransfer {
  if (!data.from_wallet_id) {
    throw new Error("From wallet ID is required");
  }
  if (!data.to_wallet_id) {
    throw new Error("To wallet ID is required");
  }
  if (data.from_wallet_id === data.to_wallet_id) {
    throw new Error("Cannot transfer to the same wallet");
  }
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  return {
    from_wallet_id: data.from_wallet_id,
    to_wallet_id: data.to_wallet_id,
    amount: data.amount,
    transaction_method:
      data.transaction_method || WalletTransactionMethod.INTERNAL_TRANSFER,
    description: data.description || null,
    notes: data.notes || null,
  };
}

export function validateWalletWithdrawal(data: any): WalletWithdrawal {
  if (!data.wallet_id) {
    throw new Error("Wallet ID is required");
  }
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (!data.description) {
    throw new Error("Description is required");
  }

  return {
    wallet_id: data.wallet_id,
    amount: data.amount,
    description: data.description,
    transaction_method: data.transaction_method || WalletTransactionMethod.CASH,
    bank_account_id: data.bank_account_id || null,
    reference_type: data.reference_type || null,
    reference_id: data.reference_id || null,
    reference_number: data.reference_number || null,
    notes: data.notes || null,
  };
}

export function validateWalletDeposit(data: any): WalletDeposit {
  if (!data.wallet_id) {
    throw new Error("Wallet ID is required");
  }
  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  if (!data.description) {
    throw new Error("Description is required");
  }

  return {
    wallet_id: data.wallet_id,
    amount: data.amount,
    description: data.description,
    transaction_method: data.transaction_method || WalletTransactionMethod.CASH,
    bank_account_id: data.bank_account_id || null,
    reference_type: data.reference_type || null,
    reference_id: data.reference_id || null,
    reference_number: data.reference_number || null,
    notes: data.notes || null,
  };
}

// Helper function to calculate totals from summary
export function calculateWalletSummaryTotals(summary: WalletSummaryResponse): {
  total_income: number;
  total_expenses: number;
  net_change: number;
} {
  const totalIncome = summary.total_deposits + summary.total_transfers_in;
  const totalExpenses =
    summary.total_withdrawals +
    summary.total_transfers_out +
    summary.total_purchases +
    summary.total_restocks;
  const netChange = totalIncome - totalExpenses;

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_change: netChange,
  };
}

// Helper function to validate date range
export function validateDateRange(startDate: Date, endDate: Date): void {
  if (startDate > endDate) {
    throw new Error("Start date must be before end date");
  }
}
