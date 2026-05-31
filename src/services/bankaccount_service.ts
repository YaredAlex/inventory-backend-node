import { BankAccount } from "../models/bank_account.js";
import { Branch } from "../models/branch.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "./logger.js";

export class BankAccountService {
  static async formatBankAccountResponse(account: BankAccount): Promise<any> {
    const branch = await Branch.findByPk(account.branch_id);

    return {
      id: account.id,
      branch_id: account.branch_id,
      branch_name: branch?.name || "Unknown Branch",
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      currency: account.currency,
      is_active: account.is_active,
      notes: account.notes,
      created_at: account.created_at,
      updated_at: account.updated_at,
    };
  }

  static async updateBankAccount(
    account: BankAccount,
    updateData: any,
  ): Promise<void> {
    const allowedFields = [
      "bank_name",
      "account_number",
      "account_name",
      "account_type",
      "currency",
      "is_active",
      "notes",
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        (account as any)[field] = updateData[field];
      }
    }

    account.updated_at = new Date();
    await account.save();

    logger.info(`Bank account updated: ID ${account.id}`);
  }
}
