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
  iban?: string | null;
  swift_code?: string | null;
  current_balance?: number | null;
  is_primary?: boolean | null;
  last_reconciled_at?: Date | null;
  last_reconciled_balance?: number | null;
  created_by?: number | null;
}

// Validation functions
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
