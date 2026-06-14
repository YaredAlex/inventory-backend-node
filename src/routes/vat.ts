// routes/vat.routes.ts
import { Router, Request, Response } from "express";
import { Op, Sequelize } from "sequelize";
import { Decimal } from "decimal.js";
import { database } from "../database.js";
import {
  VATPurchase,
  VATSale,
  VATSummary,
  VATRateHistory,
  Stock,
  StockMovement,
  BankAccount,
  Sale,
  PurchaseOrder,
  Product,
  User,
  Branch,
} from "../models/index.js";
import {
  validateVATPurchaseCreate,
  validateVATPurchaseUpdate,
  validateVATSaleCreate,
  validateVATSummaryUpdate,
  validateVATRateHistoryCreate,
  VATPurchaseResponse,
  VATSaleResponse,
  VATPurchaseStockResponse,
  VATSummaryResponse,
  VATRateHistoryResponse,
  VATPeriodReport,
  VATProductGroupReport,
  VATDashboardSummary,
  calculateVATAmount,
  calculateSellingPrice,
  calculateCOGSAndProfit,
} from "../schemas/vat.js";
import {
  requireAdmin,
  requirePrivileged,
  requireSalesman,
} from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import {
  getOrCreateWallet,
  processWalletTransaction,
} from "../services/wallet_service.js";
import {
  WalletTransactionType,
  WalletTransactionStatus,
  WalletTransactionMethod,
} from "../schemas/wallet.js";
import logger from "../services/logger.js";
import { PaymentMethod, RefundStatus, SaleStatus } from "../models/sale.js";
import { MovementType } from "../models/stock_movement.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// ==================== HELPER FUNCTIONS ====================

function generateVATNumber(prefix: string = "VAT", branchId?: number): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "");
  if (branchId) {
    return `${prefix}-${branchId}-${timestamp}`;
  }
  return `${prefix}-${timestamp}`;
}

function generateSaleNumber(branchId?: number): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "");
  if (branchId) {
    return `SALE-${branchId}-${timestamp}`;
  }
  return `SALE-${timestamp}`;
}

async function updateVATPurchaseStock(vatPurchase: any): Promise<void> {
  vatPurchase.current_stock = vatPurchase.quantity - vatPurchase.sold_quantity;
  vatPurchase.current_value = vatPurchase.current_stock * vatPurchase.unit_cost;
  vatPurchase.current_vat =
    vatPurchase.current_value * (vatPurchase.vat_rate / 100);
  await vatPurchase.save();
}

// ==================== PUBLIC BANK ACCOUNTS FOR POS ====================

router.get(
  "/public-bank-accounts",
  asyncHandler(async (req: Request, res: Response) => {
    logger.info("🚀 PUBLIC BANK ACCOUNTS ENDPOINT CALLED");

    const accounts = await BankAccount.findAll({
      where: { is_active: true },
    });

    const result = accounts.map((acc: any) => ({
      id: acc.id,
      bank_name: acc.bank_name,
      branch_name: acc.branch_name || "",
      account_number: acc.account_number,
      account_name: acc.account_name,
      account_type: acc.account_type,
      currency: acc.currency,
      is_active: acc.is_active,
      is_primary: acc.is_primary,
      account_category: acc.account_category || "regular",
    }));

    logger.info(`✅ Found ${result.length} bank accounts`);
    res.json(result);
  }),
);

// ==================== VAT PURCHASE ENDPOINTS ====================

router.post(
  "/purchases",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const purchaseData = validateVATPurchaseCreate(req.body);
    const currentUser = req.user;

    let branchId = currentUser.branch_id;
    if (currentUser.role === "admin" && purchaseData.purchase_order_id) {
      const purchaseOrder = await PurchaseOrder.findByPk(
        purchaseData.purchase_order_id,
      );
      if (purchaseOrder) {
        branchId = purchaseOrder.branch_id;
      }
    }

    if (!branchId) {
      throw new AppError("No branch assigned to user", 400);
    }

    const quantity = new Decimal(purchaseData.quantity);
    const unitCost = new Decimal(purchaseData.unit_cost);
    const vatRate = new Decimal(purchaseData.vat_rate);

    const totalCost = quantity.times(unitCost);
    const vatCalc = calculateVATAmount(
      totalCost.toNumber(),
      vatRate.toNumber(),
    );

    const sellingPriceExclVAT = unitCost.toNumber() / 0.85;
    const sellingPriceInclVAT =
      sellingPriceExclVAT * (1 + vatRate.toNumber() / 100);

    const productName =
      purchaseData.product_name ||
      purchaseData.product_group ||
      "General Stock";
    const totalAmountToDeduct = totalCost;

    // Deduct from VAT wallet
    let walletTransaction = null;
    try {
      const wallet = await getOrCreateWallet(branchId, "vat");
      walletTransaction = await processWalletTransaction(
        wallet.id,
        WalletTransactionType.PURCHASE,
        totalAmountToDeduct.toNumber(),
        `VAT Purchase - SKU: ${purchaseData.sku} - Supplier: ${purchaseData.supplier_name} - Qty: ${quantity}`,
        {
          userId: currentUser.id,
          referenceType: "vat_purchase",
        },
      );
      logger.info(
        `✅ VAT Wallet deducted: ${walletTransaction.transaction_number} - Amount: ${totalAmountToDeduct}`,
      );
    } catch (walletError: any) {
      logger.error(`⚠️ VAT Wallet deduction failed: ${walletError.message}`);
      throw new AppError(
        `Wallet deduction failed: ${walletError.message}. Insufficient funds or wallet inactive.`,
        400,
      );
    }

    const vatPurchase = await VATPurchase.create({
      vat_number: generateVATNumber("VAT-PUR", branchId),
      purchase_order_id: purchaseData.purchase_order_id || null,
      branch_id: branchId,
      product_id: purchaseData.product_id || null,
      product_name: productName,
      product_group: purchaseData.product_group || "Uncategorized",
      sku: purchaseData.sku || null,
      quantity: quantity.toNumber(),
      unit_cost: unitCost.toNumber(),
      total_cost: totalCost.toNumber(),
      vat_rate: vatRate.toNumber(),
      vat_amount: vatCalc.vat_amount,
      total_with_vat: vatCalc.incl_vat,
      calculated_selling_price: sellingPriceExclVAT,
      calculated_selling_price_with_vat: sellingPriceInclVAT,
      current_stock: quantity.toNumber(),
      supplier_name: purchaseData.supplier_name || null,
      invoice_number: purchaseData.invoice_number || null,
      purchase_date: purchaseData.purchase_date,
      notes: purchaseData.notes || null,
      status: "paid",
      created_by: currentUser.id,
    });

    if (walletTransaction) {
      walletTransaction.reference_id = vatPurchase.id;
      await walletTransaction.save();
    }

    // Record stock movement
    await StockMovement.create({
      branch_id: branchId,
      product_id: purchaseData.product_id!,
      user_id: currentUser.id,
      change_qty: quantity.toNumber(),
      movement_type: MovementType.VATPURCHASEIN,
      with_vat: true,
      reference_id: vatPurchase.id,
      notes: `VAT Purchase #${vatPurchase.vat_number} - SKU: ${purchaseData.sku} - Cost: ${unitCost}`,
    });

    // Update or create stock record
    let stock = null;
    if (purchaseData.product_id) {
      stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: purchaseData.product_id,
        },
      });
    } else {
      stock = await Stock.findOne({
        where: {
          branch_id: branchId,
        },
      });
    }

    if (stock) {
      stock.quantity += quantity.toNumber();
      if (vatRate.toNumber() > 0) {
        stock.quantity_with_vat += quantity.toNumber();
      } else {
        stock.quantity_without_vat += quantity.toNumber();
      }
      await stock.save();
    } else {
      await Stock.create({
        branch_id: branchId,
        product_id: purchaseData.product_id!,
        quantity: quantity.toNumber(),
        quantity_with_vat: vatRate.toNumber() > 0 ? quantity.toNumber() : 0,
        quantity_without_vat:
          vatRate.toNumber() === 0 ? quantity.toNumber() : 0,
        reorder_level: 0,
      });
    }

    res.status(201).json(vatPurchase);
  }),
);

router.get(
  "/purchases",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { product_id, product_group, sku, status, from_date, to_date } =
      req.query;
    const currentUser = req.user;

    const where: any = {};

    if (currentUser.role !== "admin") {
      where.branch_id = currentUser.branch_id;
    }
    if (product_id) where.product_id = product_id;
    if (sku) where.sku = sku;
    if (product_group) where.product_group = product_group;
    if (status) where.status = status;
    if (from_date) where.purchase_date = { [Op.gte]: from_date };
    if (to_date)
      where.purchase_date = { ...where.purchase_date, [Op.lte]: to_date };

    const purchases = await VATPurchase.findAll({
      where,
      order: [["purchase_date", "DESC"]],
    });

    res.json(purchases);
  }),
);

router.get(
  "/purchases/:purchaseId",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const purchaseId = parseInt(req.params.purchaseId as string);
    const currentUser = req.user;

    const purchase = await VATPurchase.findByPk(purchaseId);
    if (!purchase) {
      throw new AppError("VAT purchase not found", 404);
    }
    if (
      currentUser.role !== "admin" &&
      purchase.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Access denied", 403);
    }

    res.json(purchase);
  }),
);

router.put(
  "/purchases/:purchaseId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const purchaseId = parseInt(req.params.purchaseId as string);
    const updateData = validateVATPurchaseUpdate(req.body);

    const purchase = await VATPurchase.findByPk(purchaseId);
    if (!purchase) {
      throw new AppError("VAT purchase not found", 404);
    }
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined),
    );
    await purchase.update(cleanData);
    purchase.updated_at = new Date();
    await purchase.save();

    res.json(purchase);
  }),
);

// ==================== VAT SALE ENDPOINTS ====================

router.post(
  "/sales",
  requireSalesman,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const saleData = validateVATSaleCreate(req.body);
    const currentUser = req.user;

    const vatPurchase = await VATPurchase.findByPk(saleData.vat_purchase_id);
    if (!vatPurchase) {
      throw new AppError("VAT purchase not found", 404);
    }

    const quantity = new Decimal(saleData.quantity);
    const sellingPrice = new Decimal(saleData.selling_price);

    if (vatPurchase.current_stock < quantity.toNumber()) {
      throw new AppError(
        `Insufficient stock. Available: ${vatPurchase.current_stock}`,
        400,
      );
    }

    let sale = null;
    if (saleData.sale_id) {
      sale = await Sale.findByPk(saleData.sale_id);
      if (!sale) {
        throw new AppError("Sale not found", 404);
      }
    } else {
      const branchId = currentUser.branch_id || vatPurchase.branch_id;
      const totalAmount = quantity.times(sellingPrice).toNumber();

      sale = await Sale.create({
        invoice_number: generateSaleNumber(branchId),
        branch_id: branchId,
        user_id: currentUser.id,
        customer_name: saleData.customer_name || "Walk-in Customer",
        customer_phone: null,
        customer_email: null,
        subtotal: totalAmount,
        tax_amount: 0,
        tax_rate: 0,
        discount_amount: 0,
        discount_type: "fixed",
        shipping_cost: 0,
        total_amount: totalAmount,
        total_cost: quantity.times(vatPurchase.unit_cost).toNumber(),
        payment_method: PaymentMethod.CASH,
        bank_account_id: null,
        transaction_reference: null,
        status: SaleStatus.COMPLETED,
        refund_amount: 0,
        refund_status: RefundStatus.NONE,
        notes: saleData.notes || null,
      });
    }

    const vatCalc = calculateVATAmount(
      quantity.times(sellingPrice).toNumber(),
      vatPurchase.vat_rate,
    );
    const cogsCalc = calculateCOGSAndProfit(
      quantity.toNumber(),
      vatPurchase.unit_cost,
      sellingPrice.toNumber(),
    );

    const vatSale = await VATSale.create({
      vat_sale_number: generateVATNumber("VAT-SALE", sale.branch_id),
      sale_id: sale.id,
      sale_item_id: saleData.sale_item_id || null,
      vat_purchase_id: saleData.vat_purchase_id,
      branch_id: sale.branch_id,
      product_id: vatPurchase.product_id,
      product_name: vatPurchase.product_name,
      product_group: vatPurchase.product_group,
      sku: vatPurchase.sku,
      quantity: quantity.toNumber(),
      unit_cost: vatPurchase.unit_cost,
      selling_price: sellingPrice.toNumber(),
      selling_price_with_vat:
        quantity.toNumber() > 0 ? vatCalc.incl_vat / quantity.toNumber() : 0,
      vat_rate: vatPurchase.vat_rate,
      vat_amount: vatCalc.vat_amount,
      total_amount: vatCalc.excl_vat,
      total_amount_with_vat: vatCalc.incl_vat,
      cost_of_goods_sold: cogsCalc.cogs,
      profit: cogsCalc.profit,
      profit_margin: cogsCalc.profit_margin,
      customer_name: sale.customer_name,
      invoice_number: sale.invoice_number,
      sale_date: sale.created_at,
      created_by: currentUser.id,
    });

    vatPurchase.sold_quantity += quantity.toNumber();
    vatPurchase.sold_value += quantity.times(sellingPrice).toNumber();
    vatPurchase.sold_vat += vatCalc.vat_amount;
    await updateVATPurchaseStock(vatPurchase);

    await StockMovement.create({
      branch_id: sale.branch_id,
      product_id: vatPurchase.product_id!,
      user_id: currentUser.id,
      change_qty: -quantity.toNumber(),
      movement_type: MovementType.VATSALEOUT,
      with_vat: true,
      reference_id: vatSale.id,
      notes: `VAT Sale #${vatSale.vat_sale_number} - SKU: ${vatPurchase.sku} - Price: ${sellingPrice}`,
    });

    const stock = await Stock.findOne({
      where: {
        branch_id: sale.branch_id,
        product_id: vatPurchase.product_id!,
      },
    });

    if (stock) {
      stock.quantity -= quantity.toNumber();
      if (vatPurchase.vat_rate > 0) {
        stock.quantity_with_vat -= quantity.toNumber();
      } else {
        stock.quantity_without_vat -= quantity.toNumber();
      }
      await stock.save();
    }

    // Credit to VAT wallet
    const totalSaleAmount = vatSale.total_amount_with_vat;
    try {
      const wallet = await getOrCreateWallet(sale.branch_id, "vat");
      const walletTransaction = await processWalletTransaction(
        wallet.id,
        WalletTransactionType.DEPOSIT,
        totalSaleAmount,
        `VAT Sale #${vatSale.vat_sale_number} - Customer: ${sale.customer_name || "Walk-in"} - Qty: ${quantity} of ${vatPurchase.product_name}`,
        {
          userId: currentUser.id,
          transactionMethod: WalletTransactionMethod.CASH,
          referenceType: "vat_sale",
          referenceId: vatSale.id,
        },
      );

      vatSale.wallet_transaction_id = walletTransaction.id;
      await vatSale.save();
      logger.info(
        `✅ VAT Wallet credited: ${walletTransaction.transaction_number} - Amount: ${totalSaleAmount}`,
      );
    } catch (walletError: any) {
      logger.error(`⚠️ VAT Wallet credit failed: ${walletError.message}`);
    }

    res.status(201).json(vatSale);
  }),
);

router.get(
  "/sales",
  requireSalesman,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      product_id,
      sku,
      product_group,
      vat_purchase_id,
      from_date,
      to_date,
    } = req.query;
    const currentUser = req.user;

    const where: any = {};

    if (currentUser.role !== "admin") {
      where.branch_id = currentUser.branch_id;
    }
    if (product_id) where.product_id = product_id;
    if (sku) where.sku = sku;
    if (product_group) where.product_group = product_group;
    if (vat_purchase_id) where.vat_purchase_id = vat_purchase_id;
    if (from_date) where.sale_date = { [Op.gte]: from_date };
    if (to_date) where.sale_date = { ...where.sale_date, [Op.lte]: to_date };

    const sales = await VATSale.findAll({
      where,
      order: [["sale_date", "DESC"]],
    });

    res.json(sales);
  }),
);

router.get(
  "/sales/:saleId",
  requireSalesman,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const saleId = parseInt(req.params.saleId as string);
    const currentUser = req.user;

    const sale = await VATSale.findByPk(saleId);
    if (!sale) {
      throw new AppError("VAT sale not found", 404);
    }
    if (
      currentUser.role !== "admin" &&
      sale.branch_id !== currentUser.branch_id
    ) {
      throw new AppError("Access denied", 403);
    }

    res.json(sale);
  }),
);

// ==================== STOCK TRACKING ENDPOINTS ====================

router.get(
  "/stock",
  requireSalesman,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { product_id, sku, product_group } = req.query;
    const currentUser = req.user;

    const where: any = {
      current_stock: { [Op.gt]: 0 },
      status: "paid",
    };

    if (currentUser.role !== "admin") {
      where.branch_id = currentUser.branch_id;
    }
    if (product_id) where.product_id = product_id;
    if (sku) where.sku = sku;
    if (product_group) where.product_group = product_group;

    const purchases = await VATPurchase.findAll({
      where,
      order: [["purchase_date", "ASC"]],
    });

    const stockItems = purchases.map((p: any) => ({
      id: p.id,
      vat_number: p.vat_number,
      product_id: p.product_id,
      product_name: p.product_name,
      product_group: p.product_group,
      sku: p.sku,
      current_stock: parseFloat(p.current_stock),
      unit_cost: parseFloat(p.unit_cost),
      current_value: parseFloat(p.current_value),
      purchase_date: p.purchase_date,
      supplier_name: p.supplier_name,
      calculated_selling_price: parseFloat(p.unit_cost) / 0.85,
      vat_rate: parseFloat(p.vat_rate),
      status: p.status,
    }));

    logger.info(`Found ${stockItems.length} stock items from PAID purchases`);
    res.json(stockItems);
  }),
);

router.get(
  "/stock-summary",
  requireSalesman,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user;

    const where: any = {
      current_stock: { [Op.gt]: 0 },
      status: "paid",
    };

    if (currentUser.role !== "admin") {
      where.branch_id = currentUser.branch_id;
    }

    const purchases = await VATPurchase.findAll({ where });

    let totalStockValue = 0;
    let totalStockVAT = 0;
    let totalItems = 0;
    const uniqueProducts = new Set();
    const uniqueSKU = new Set();

    purchases.forEach((p: any) => {
      totalStockValue += parseFloat(p.current_value);
      totalStockVAT += parseFloat(p.current_vat);
      totalItems += parseFloat(p.current_stock);
      if (p.product_id) uniqueProducts.add(p.product_id);
      if (p.sku) uniqueSKU.add(p.sku);
    });

    res.json({
      total_items: totalItems,
      total_stock_value: totalStockValue,
      total_stock_vat: totalStockVAT,
      total_stock_with_vat: totalStockValue + totalStockVAT,
      unique_products: uniqueProducts.size,
      unique_sku_groups: uniqueSKU.size,
      purchase_batches: purchases.length,
    });
  }),
);

router.get(
  "/stock/debug",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const allPurchases = await VATPurchase.findAll();
    const purchasesWithStock = await VATPurchase.findAll({
      where: { current_stock: { [Op.gt]: 0 } },
    });
    const paidPurchases = await VATPurchase.findAll({
      where: { status: "paid" },
    });
    const pendingPurchases = await VATPurchase.findAll({
      where: { status: "pending" },
    });
    const completedPurchases = await VATPurchase.findAll({
      where: { status: "completed" },
    });
    const nullStatus = await VATPurchase.findAll({
      where: {
        status: { [Op.is]: Sequelize.literal("NULL") },
      },
    });
    const availableStock = await VATPurchase.findAll({
      where: {
        status: "paid",
        current_stock: { [Op.gt]: 0 },
      },
    });

    res.json({
      total_vat_purchases: allPurchases.length,
      purchases_with_positive_stock: purchasesWithStock.length,
      purchases_with_status_paid: paidPurchases.length,
      purchases_with_status_pending: pendingPurchases.length,
      purchases_with_status_completed: completedPurchases.length,
      purchases_with_null_status: nullStatus.length,
      available_for_sale_paid_stock_gt_0: availableStock.length,
      all_purchases: allPurchases.slice(0, 20).map((p: any) => ({
        id: p.id,
        vat_number: p.vat_number,
        product_name: p.product_name,
        current_stock: parseFloat(p.current_stock),
        quantity: parseFloat(p.quantity),
        sold_quantity: parseFloat(p.sold_quantity),
        status: p.status,
        unit_cost: parseFloat(p.unit_cost),
        selling_price: p.calculated_selling_price
          ? parseFloat(p.calculated_selling_price)
          : null,
        branch_id: p.branch_id,
        product_group: p.product_group,
        sku: p.sku,
      })),
    });
  }),
);

// ==================== VAT SUMMARY ENDPOINTS ====================

router.post(
  "/summaries/generate",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { year, month } = req.query;
    const currentUser = req.user;

    const summaryMonth = `${year}-${String(month).padStart(2, "0")}`;

    const existing = await VATSummary.findOne({
      where: {
        summary_month: summaryMonth,
        branch_id: currentUser.branch_id,
      },
    });

    if (existing) {
      throw new AppError("Summary already exists for this month", 400);
    }

    const startDate = new Date(
      parseInt(year as string),
      parseInt(month as string) - 1,
      1,
    );
    const endDate = new Date(
      parseInt(year as string),
      parseInt(month as string),
      0,
    );

    const purchaseWhere: any = {
      purchase_date: {
        [Op.between]: [startDate, endDate],
      },
    };
    if (currentUser.role !== "admin") {
      purchaseWhere.branch_id = currentUser.branch_id;
    }

    const purchases = await VATPurchase.findAll({ where: purchaseWhere });

    let totalPurchasesExclVAT = 0;
    let totalPurchaseVAT = 0;
    let totalPurchasesInclVAT = 0;
    const purchaseByGroup: any = {};

    purchases.forEach((p: any) => {
      totalPurchasesExclVAT += parseFloat(p.total_cost);
      totalPurchaseVAT += parseFloat(p.vat_amount);
      totalPurchasesInclVAT += parseFloat(p.total_with_vat);

      const group = p.product_group || "Uncategorized";
      if (!purchaseByGroup[group]) {
        purchaseByGroup[group] = { excl_vat: 0, vat: 0, incl_vat: 0 };
      }
      purchaseByGroup[group].excl_vat += parseFloat(p.total_cost);
      purchaseByGroup[group].vat += parseFloat(p.vat_amount);
      purchaseByGroup[group].incl_vat += parseFloat(p.total_with_vat);
    });

    const saleWhere: any = {
      sale_date: {
        [Op.between]: [startDate, endDate],
      },
    };
    if (currentUser.role !== "admin") {
      saleWhere.branch_id = currentUser.branch_id;
    }

    const sales = await VATSale.findAll({ where: saleWhere });

    let totalSalesExclVAT = 0;
    let totalSaleVAT = 0;
    let totalSalesInclVAT = 0;
    let totalProfit = 0;
    const saleByGroup: any = {};

    sales.forEach((s: any) => {
      totalSalesExclVAT += parseFloat(s.total_amount);
      totalSaleVAT += parseFloat(s.vat_amount);
      totalSalesInclVAT += parseFloat(s.total_amount_with_vat);
      totalProfit += parseFloat(s.profit);

      const group = s.product_group || "Uncategorized";
      if (!saleByGroup[group]) {
        saleByGroup[group] = { excl_vat: 0, vat: 0, incl_vat: 0, profit: 0 };
      }
      saleByGroup[group].excl_vat += parseFloat(s.total_amount);
      saleByGroup[group].vat += parseFloat(s.vat_amount);
      saleByGroup[group].incl_vat += parseFloat(s.total_amount_with_vat);
      saleByGroup[group].profit += parseFloat(s.profit);
    });

    const avgProfitMargin =
      totalSalesExclVAT > 0 ? (totalProfit / totalSalesExclVAT) * 100 : 0;
    const vatPayable = totalSaleVAT - totalPurchaseVAT;
    const vatReceivable = vatPayable < 0 ? -vatPayable : 0;
    const netVAT = vatPayable > 0 ? vatPayable : vatReceivable;

    const summary = await VATSummary.create({
      branch_id: currentUser.role === "admin" ? 1 : currentUser.branch_id,
      summary_month: summaryMonth,
      summary_year: parseInt(year as string),
      summary_month_num: parseInt(month as string),
      total_purchases_excl_vat: totalPurchasesExclVAT,
      total_purchase_vat: totalPurchaseVAT,
      total_purchases_incl_vat: totalPurchasesInclVAT,
      purchase_count: purchases.length,
      purchase_by_group: JSON.stringify(purchaseByGroup),
      total_sales_excl_vat: totalSalesExclVAT,
      total_sale_vat: totalSaleVAT,
      total_sales_incl_vat: totalSalesInclVAT,
      sale_count: sales.length,
      sale_by_group: JSON.stringify(saleByGroup),
      vat_payable: vatPayable > 0 ? vatPayable : 0,
      vat_receivable: vatReceivable,
      net_vat: netVAT,
      total_profit_excl_vat: totalProfit,
      average_profit_margin: avgProfitMargin,
      status: "pending",
      created_by: currentUser.id,
    });

    if (summary.purchase_by_group) {
      summary.purchase_by_group = JSON.parse(summary.purchase_by_group);
    }
    if (summary.sale_by_group) {
      summary.sale_by_group = JSON.parse(summary.sale_by_group);
    }

    res.json(summary);
  }),
);

router.get(
  "/summaries",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { year, status } = req.query;
    const currentUser = req.user;

    const where: any = {};
    if (year) where.summary_year = year;
    if (status) where.status = status;
    if (currentUser.role !== "admin") where.branch_id = currentUser.branch_id;

    const summaries = await VATSummary.findAll({
      where,
      order: [
        ["summary_year", "DESC"],
        ["summary_month_num", "DESC"],
      ],
    });

    summaries.forEach((summary: any) => {
      if (summary.purchase_by_group) {
        summary.purchase_by_group = JSON.parse(summary.purchase_by_group);
      } else {
        summary.purchase_by_group = {};
      }
      if (summary.sale_by_group) {
        summary.sale_by_group = JSON.parse(summary.sale_by_group);
      } else {
        summary.sale_by_group = {};
      }
    });

    res.json(summaries);
  }),
);

router.put(
  "/summaries/:summaryId",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summaryId = parseInt(req.params.summaryId as string);
    const updateData = validateVATSummaryUpdate(req.body);

    const summary = await VATSummary.findByPk(summaryId);
    if (!summary) {
      throw new AppError("VAT summary not found", 404);
    }
    const cleanData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined),
    );

    await summary.update(cleanData);
    summary.updated_at = new Date();
    await summary.save();

    if (summary.purchase_by_group) {
      summary.purchase_by_group = JSON.parse(summary.purchase_by_group);
    }
    if (summary.sale_by_group) {
      summary.sale_by_group = JSON.parse(summary.sale_by_group);
    }

    res.json(summary);
  }),
);

// ==================== VAT RATE HISTORY ENDPOINTS ====================

router.post(
  "/rates",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rateData = validateVATRateHistoryCreate(req.body);
    const currentUser = req.user;

    const previousRate = await VATRateHistory.findOne({
      where: { effective_to: null },
    });

    if (previousRate) {
      const endDate = new Date(rateData.effective_from);
      endDate.setDate(endDate.getDate() - 1);
      previousRate.effective_to = endDate;
      await previousRate.save();
    }

    const vatRate = await VATRateHistory.create({
      vat_rate: rateData.vat_rate,
      effective_from: rateData.effective_from,
      effective_to: rateData.effective_to || null,
      notes: rateData.notes || null,
      created_by: currentUser.id,
    });

    res.status(201).json(vatRate);
  }),
);

router.get(
  "/rates",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const rates = await VATRateHistory.findAll({
      order: [["effective_from", "DESC"]],
    });
    res.json(rates);
  }),
);

router.get(
  "/rates/current",
  requirePrivileged,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentRate = await VATRateHistory.findOne({
      where: { effective_to: null },
    });

    if (!currentRate) {
      res.json({ vat_rate: 15.0, message: "Default rate 15%" });
    } else {
      res.json({
        vat_rate: parseFloat(currentRate.vat_rate as any),
        effective_from: currentRate.effective_from,
      });
    }
  }),
);

// ==================== VAT REPORT ENDPOINTS ====================

router.get(
  "/reports/period",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { from_date, to_date, branch_id } = req.query;

    const startDatetime = new Date(from_date as string);
    startDatetime.setHours(0, 0, 0, 0);
    const endDatetime = new Date(to_date as string);
    endDatetime.setHours(23, 59, 59, 999);

    const purchaseWhere: any = {
      purchase_date: {
        [Op.between]: [startDatetime, endDatetime],
      },
    };
    if (branch_id) purchaseWhere.branch_id = branch_id;

    const purchases = await VATPurchase.findAll({ where: purchaseWhere });

    const saleWhere: any = {
      sale_date: {
        [Op.between]: [startDatetime, endDatetime],
      },
    };
    if (branch_id) saleWhere.branch_id = branch_id;

    const sales = await VATSale.findAll({ where: saleWhere });

    let totalPurchases = 0;
    let totalPurchaseVAT = 0;
    const purchasesByGroup: Record<string, number> = {};

    purchases.forEach((p: any) => {
      totalPurchases += parseFloat(p.total_cost);
      totalPurchaseVAT += parseFloat(p.vat_amount);
      const group = p.product_group || "Uncategorized";
      purchasesByGroup[group] =
        (purchasesByGroup[group] || 0) + parseFloat(p.total_cost);
    });

    let totalSales = 0;
    let totalSaleVAT = 0;
    const salesByGroup: Record<string, number> = {};

    sales.forEach((s: any) => {
      totalSales += parseFloat(s.total_amount);
      totalSaleVAT += parseFloat(s.vat_amount);
      const group = s.product_group || "Uncategorized";
      salesByGroup[group] =
        (salesByGroup[group] || 0) + parseFloat(s.total_amount);
    });

    const vatPayable = Math.max(0, totalSaleVAT - totalPurchaseVAT);
    const vatReceivable = Math.max(0, totalPurchaseVAT - totalSaleVAT);
    const grossProfit = totalSales - totalPurchases;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    res.json({
      period_start: from_date,
      period_end: to_date,
      branch_id: branch_id || null,
      branch_name: null,
      total_purchases: totalPurchases,
      total_purchase_vat: totalPurchaseVAT,
      purchases_by_group: purchasesByGroup,
      total_sales: totalSales,
      total_sale_vat: totalSaleVAT,
      sales_by_group: salesByGroup,
      vat_payable: vatPayable,
      vat_receivable: vatReceivable,
      net_vat_due: vatPayable - vatReceivable,
      gross_profit: grossProfit,
      profit_margin: profitMargin,
      purchase_transactions: purchases,
      sale_transactions: sales,
    });
  }),
);

router.get(
  "/reports/product-groups",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { year, month } = req.query;
    const currentUser = req.user;

    const purchaseWhere: any = {};
    let saleWhere: any = {};

    if (year && month) {
      const startDate = new Date(
        parseInt(year as string),
        parseInt(month as string) - 1,
        1,
      );
      const endDate = new Date(
        parseInt(year as string),
        parseInt(month as string),
        0,
      );
      purchaseWhere.purchase_date = {
        [Op.between]: [startDate, endDate],
      };
      saleWhere.sale_date = {
        [Op.between]: [startDate, endDate],
      };
    }

    // Fetch both purchases and sales in parallel
    const [purchases, sales] = await Promise.all([
      VATPurchase.findAll({
        where: purchaseWhere,
      }),
      VATSale.findAll({
        where: saleWhere,
        include: [
          {
            model: VATPurchase,
            as: "vat_purchase",
            attributes: ["product_group"],
          },
        ],
      }),
    ]);

    const groups: Record<string, any> = {};

    // Process purchases
    purchases.forEach((p: any) => {
      const group = p.product_group || "Uncategorized";
      if (!groups[group]) {
        groups[group] = {
          product_group: group,
          total_purchases_excl_vat: 0,
          total_purchase_vat: 0,
          total_sales_excl_vat: 0,
          total_sale_vat: 0,
          vat_contribution: 0,
          profit: 0,
          profit_margin: 0,
          quantity_purchased: 0,
          quantity_sold: 0,
        };
      }

      groups[group].total_purchases_excl_vat += parseFloat(p.total_cost);
      groups[group].total_purchase_vat += parseFloat(p.vat_amount);
      groups[group].quantity_purchased += parseFloat(p.quantity);
    });

    // Process sales
    sales.forEach((sale: any) => {
      const group = sale.vat_purchase?.product_group || "Uncategorized";

      if (!groups[group]) {
        groups[group] = {
          product_group: group,
          total_purchases_excl_vat: 0,
          total_purchase_vat: 0,
          total_sales_excl_vat: 0,
          total_sale_vat: 0,
          vat_contribution: 0,
          profit: 0,
          profit_margin: 0,
          quantity_purchased: 0,
          quantity_sold: 0,
        };
      }

      groups[group].total_sales_excl_vat += parseFloat(sale.total_amount);
      groups[group].total_sale_vat += parseFloat(sale.vat_amount);
      groups[group].profit += parseFloat(sale.profit);
      groups[group].quantity_sold += parseFloat(sale.quantity);
    });

    const result = Object.values(groups).map((group: any) => {
      group.vat_contribution = group.total_sale_vat - group.total_purchase_vat;
      group.profit_margin =
        group.total_sales_excl_vat > 0
          ? (group.profit / group.total_sales_excl_vat) * 100
          : 0;
      return group;
    });

    res.json(result);
  }),
);

router.get(
  "/dashboard",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;

    let currentSummary = await VATSummary.findOne({
      where: { summary_month: currentMonth },
    });
    let previousSummary = await VATSummary.findOne({
      where: { summary_month: previousMonth },
    });

    if (currentSummary) {
      if (currentSummary.purchase_by_group) {
        currentSummary.purchase_by_group = JSON.parse(
          currentSummary.purchase_by_group,
        );
      }
      if (currentSummary.sale_by_group) {
        currentSummary.sale_by_group = JSON.parse(currentSummary.sale_by_group);
      }
    }

    if (previousSummary) {
      if (previousSummary.purchase_by_group) {
        previousSummary.purchase_by_group = JSON.parse(
          previousSummary.purchase_by_group,
        );
      }
      if (previousSummary.sale_by_group) {
        previousSummary.sale_by_group = JSON.parse(
          previousSummary.sale_by_group,
        );
      }
    }

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearToDatePurchases = await VATPurchase.findAll({
      where: { purchase_date: { [Op.gte]: yearStart } },
    });
    const yearToDateSales = await VATSale.findAll({
      where: { sale_date: { [Op.gte]: yearStart } },
    });

    const ytdPurchases = yearToDatePurchases.reduce(
      (sum: any, p: any) => sum + parseFloat(p.total_cost),
      0,
    );
    const ytdSales = yearToDateSales.reduce(
      (sum: any, s: any) => sum + parseFloat(s.total_amount),
      0,
    );
    const ytdPurchaseVAT = yearToDatePurchases.reduce(
      (sum: any, p: any) => sum + parseFloat(p.vat_amount),
      0,
    );
    const ytdSaleVAT = yearToDateSales.reduce(
      (sum: any, s: any) => sum + parseFloat(s.vat_amount),
      0,
    );

    const pendingReturns = await VATSummary.count({
      where: { status: "pending" },
    });

    const currentRate = await VATRateHistory.findOne({
      where: { effective_to: null },
    });

    const rateHistory = await VATRateHistory.findAll({
      order: [["effective_from", "DESC"]],
      limit: 5,
    });

    res.json({
      current_month_summary: currentSummary,
      previous_month_summary: previousSummary,
      year_to_date_purchases: ytdPurchases,
      year_to_date_sales: ytdSales,
      year_to_date_vat_payable: ytdSaleVAT - ytdPurchaseVAT,
      pending_vat_returns: pendingReturns,
      current_vat_rate: currentRate
        ? parseFloat(currentRate.vat_rate as any)
        : 15.0,
      vat_rate_history: rateHistory,
      top_product_groups_by_vat: [],
    });
  }),
);

// ==================== CALCULATION UTILITY ENDPOINTS ====================

router.post(
  "/calculate-selling-price",
  asyncHandler(async (req: Request, res: Response) => {
    const { unit_cost, markup_percentage = 15.0, vat_rate = 15.0 } = req.body;
    const result = calculateSellingPrice(
      unit_cost,
      markup_percentage,
      vat_rate,
    );
    res.json(result);
  }),
);

router.post(
  "/calculate-vat",
  asyncHandler(async (req: Request, res: Response) => {
    const { amount, vat_rate = 15.0 } = req.body;
    const result = calculateVATAmount(amount, vat_rate);
    res.json(result);
  }),
);

export default router;
