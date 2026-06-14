import { Sequelize } from "sequelize";
import { Branch } from "./branch.js";
import { Product } from "./product.js";
import { User } from "./user.js";
import { BankAccount } from "./bank_account.js";
import { Stock } from "./stock.js";
import { Sale } from "./sale.js";
import { SaleItem } from "./sale_item.js";
import { Refund } from "./refund.js";
import { RefundItem } from "./refund_item.js";
import { PurchaseOrder } from "./purchase_order.js";
import { PurchaseOrderItem } from "./purchase_order_item.js";
import { Purchase } from "./purchase.js";
import { PurchaseItem } from "./purchase_item.js";
import { Loan } from "./loan.js";
import { LoanItem } from "./loan_item.js";
import { LoanPayment } from "./loan_payment.js";
import { LoanSummary } from "./loan_summary.js";
import { StockMovement } from "./stock_movement.js";
import { Alert } from "./alert.js";
import { SystemSetting } from "./system_setting.js";
import { BackupRecord } from "./backup_record.js";
import { SystemLog } from "./system_log.js";
import { TempItem } from "./tmp_item.js";

// Bulk Product Models
import { BulkProduct } from "./bulk_product.js";
import { BulkPurchaseOrder } from "./bulk_purchase_order.js";
import { BulkPurchaseOrderItem } from "./bulk_purchase_order_item.js";
import { BulkStock } from "./bulk_stock.js";
import { BulkStockMovement } from "./bulk_stock_movement.js";
import { BulkSaleItem } from "./bulk_sale_item.js";
import { BulkAlert } from "./bulk_alert.js";

// VAT and Wallet Models
import { Wallet } from "./wallet.js";
import { WalletTransaction } from "./wallet_transaction.js";
import { WalletSummary } from "./wallet_summary.js";
import { BankTransaction } from "./bank_transaction.js";
import { VATPurchase } from "./vat_purchase.js";
import { VATSale } from "./vat_sale.js";
import { VATSummary } from "./val_summary.js";
import { VATRateHistory } from "./vat_rate_summary.js";

// Export all models (regular + bulk + vat + wallet)
export {
  // Regular models
  Branch,
  Product,
  User,
  BankAccount,
  Stock,
  Sale,
  SaleItem,
  Refund,
  RefundItem,
  PurchaseOrder,
  PurchaseOrderItem,
  Purchase,
  PurchaseItem,
  Loan,
  LoanItem,
  LoanPayment,
  LoanSummary,
  StockMovement,
  Alert,
  SystemSetting,
  BackupRecord,
  SystemLog,
  TempItem,
  // Bulk models
  BulkProduct,
  BulkPurchaseOrder,
  BulkPurchaseOrderItem,
  BulkStock,
  BulkStockMovement,
  BulkSaleItem,
  BulkAlert,
  // VAT and Wallet models
  Wallet,
  WalletTransaction,
  WalletSummary,
  BankTransaction,
  VATPurchase,
  VATSale,
  VATSummary,
  VATRateHistory,
};

// Initialize all models and setup associations
export function initModels(sequelize: Sequelize) {
  // Initialize regular models in order (no circular dependencies)
  Branch.initModel(sequelize);
  Product.initModel(sequelize);
  User.initModel(sequelize);
  BankAccount.initModel(sequelize);
  Stock.initModel(sequelize);
  Sale.initModel(sequelize);
  SaleItem.initModel(sequelize);
  Refund.initModel(sequelize);
  RefundItem.initModel(sequelize);
  PurchaseOrder.initModel(sequelize);
  PurchaseOrderItem.initModel(sequelize);
  Purchase.initModel(sequelize);
  PurchaseItem.initModel(sequelize);
  Loan.initModel(sequelize);
  LoanItem.initModel(sequelize);
  LoanPayment.initModel(sequelize);
  LoanSummary.initModel(sequelize);
  StockMovement.initModel(sequelize);
  Alert.initModel(sequelize);
  SystemSetting.initModel(sequelize);
  BackupRecord.initModel(sequelize);
  SystemLog.initModel(sequelize);
  TempItem.initModel(sequelize);

  // Initialize bulk models
  BulkProduct.initModel(sequelize);
  BulkPurchaseOrder.initModel(sequelize);
  BulkPurchaseOrderItem.initModel(sequelize);
  BulkStock.initModel(sequelize);
  BulkStockMovement.initModel(sequelize);
  BulkSaleItem.initModel(sequelize);
  BulkAlert.initModel(sequelize);

  // Initialize VAT and Wallet models
  Wallet.initModel(sequelize);
  WalletTransaction.initModel(sequelize);
  WalletSummary.initModel(sequelize);
  BankTransaction.initModel(sequelize);
  VATPurchase.initModel(sequelize);
  VATSale.initModel(sequelize);
  VATSummary.initModel(sequelize);
  VATRateHistory.initModel(sequelize);

  // Setup associations for regular models after all models are initialized
  Branch.associate(sequelize.models);
  Product.associate(sequelize.models);
  User.associate(sequelize.models);
  BankAccount.associate(sequelize.models);
  Stock.associate(sequelize.models);
  Sale.associate(sequelize.models);
  SaleItem.associate(sequelize.models);
  Refund.associate(sequelize.models);
  RefundItem.associate(sequelize.models);
  PurchaseOrder.associate(sequelize.models);
  PurchaseOrderItem.associate(sequelize.models);
  Purchase.associate(sequelize.models);
  PurchaseItem.associate(sequelize.models);
  Loan.associate(sequelize.models);
  LoanItem.associate(sequelize.models);
  LoanPayment.associate(sequelize.models);
  LoanSummary.associate(sequelize.models);
  StockMovement.associate(sequelize.models);
  Alert.associate(sequelize.models);
  SystemSetting.associate(sequelize.models);
  BackupRecord.associate(sequelize.models);
  SystemLog.associate(sequelize.models);
  TempItem.associate(sequelize.models);

  // Setup associations for bulk models
  BulkProduct.associate(sequelize.models);
  BulkPurchaseOrder.associate(sequelize.models);
  BulkPurchaseOrderItem.associate(sequelize.models);
  BulkStock.associate(sequelize.models);
  BulkStockMovement.associate(sequelize.models);
  BulkSaleItem.associate(sequelize.models);
  BulkAlert.associate(sequelize.models);

  // Setup associations for VAT and Wallet models
  Wallet.associate(sequelize.models);
  WalletTransaction.associate(sequelize.models);
  WalletSummary.associate(sequelize.models);
  BankTransaction.associate(sequelize.models);
  VATPurchase.associate(sequelize.models);
  VATSale.associate(sequelize.models);
  VATSummary.associate(sequelize.models);
  VATRateHistory.associate(sequelize.models);

  console.log(
    "✅ All 39 models initialized and associations set up (24 regular + 7 bulk + 8 vat/wallet models)",
  );
}
