import { Router, Request, Response } from "express";
import { database } from "../database.js";
import { ReportService } from "../services/report_services.js";
import { requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import { Sale } from "../models/sale.js";
import { SaleItem } from "../models/sale_item.js";
import { Product } from "../models/product.js";
import { Purchase } from "../models/purchase.js";
import { PurchaseItem } from "../models/purchase_item.js";
import { PurchaseOrder } from "../models/purchase_order.js";
import { PurchaseOrderItem } from "../models/purchase_order_item.js";
import { Loan } from "../models/loan.js";
import { LoanPayment } from "../models/loan_payment.js";
import { Stock } from "../models/stock.js";
import { Op, fn, col, literal } from "sequelize";
import logger from "../services/logger.js";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All report routes require admin access
router.use(requireAdmin);

// GET - Sales report
router.get(
  "/sales",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reportType = req.query.report_type as "weekly" | "monthly";
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : null;
    const includeLoanRepayments = req.query.include_loan_repayments !== "false";
    const includePurchases = req.query.include_purchases !== "false";

    if (!reportType || !["weekly", "monthly"].includes(reportType)) {
      throw new AppError("report_type must be weekly or monthly", 400);
    }

    const report = await ReportService.generateSalesReport(
      database.sequelize!,
      reportType,
      branchId,
      includeLoanRepayments,
      includePurchases,
    );

    res.json(report);
  }),
);

// GET - Purchase report
router.get(
  "/purchases",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;
    const supplier = req.query.supplier as string;

    const report = await ReportService.generatePurchaseReport(
      database.sequelize!,
      fromDate,
      toDate,
      supplier,
    );

    res.json(report);
  }),
);

// GET - Loan report
router.get(
  "/loans",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;
    const status = req.query.status as string;
    const customerName = req.query.customer_name as string;

    const report = await ReportService.generateLoanReport(
      database.sequelize!,
      fromDate,
      toDate,
      status,
      customerName,
    );

    res.json(report);
  }),
);

// GET - Profit/Loss report
router.get(
  "/profit-loss",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;

    const report = await ReportService.generateProfitLossReport(
      database.sequelize!,
      fromDate,
      toDate,
    );

    res.json(report);
  }),
);

// GET - Inventory valuation report
router.get(
  "/inventory-valuation",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const report = await ReportService.getInventoryValuation(
      database.sequelize!,
    );
    res.json(report);
  }),
);

// GET - Dashboard summary
router.get(
  "/dashboard-summary",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await ReportService.getDashboardSummary(
      database.sequelize!,
    );
    res.json(summary);
  }),
);

// GET - Financial summary
router.get(
  "/financial-summary",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;

    const startDate = fromDate ? new Date(fromDate) : undefined;
    if (startDate) startDate.setHours(0, 0, 0, 0);

    const endDate = toDate ? new Date(toDate) : undefined;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const whereClause: any = {};
    if (startDate) whereClause.created_at = { [Op.gte]: startDate };
    if (endDate)
      whereClause.created_at = { ...whereClause.created_at, [Op.lte]: endDate };

    const sales = await Sale.findAll({ where: whereClause });
    const totalRevenue = sales.reduce(
      (sum, s) => sum + Number(s.total_amount),
      0,
    );

    const purchaseWhere: any = {};
    if (startDate) purchaseWhere.created_at = { [Op.gte]: startDate };
    if (endDate)
      purchaseWhere.created_at = {
        ...purchaseWhere.created_at,
        [Op.lte]: endDate,
      };

    const purchases = await Purchase.findAll({ where: purchaseWhere });
    const totalExpenses = purchases.reduce(
      (sum, p) => sum + Number(p.total_amount),
      0,
    );

    const loanPaymentWhere: any = {};
    if (startDate) loanPaymentWhere.payment_date = { [Op.gte]: startDate };
    if (endDate)
      loanPaymentWhere.payment_date = {
        ...loanPaymentWhere.payment_date,
        [Op.lte]: endDate,
      };

    const loanPayments = await LoanPayment.findAll({ where: loanPaymentWhere });
    const loanRepayments = loanPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const outstandingLoans = await Loan.sum("remaining_amount", {
      where: { remaining_amount: { [Op.gt]: 0 } },
    });

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    res.json({
      total_revenue: totalRevenue,
      net_profit: netProfit,
      total_expenses: totalExpenses,
      loan_repayments: loanRepayments,
      outstanding_loans: Number(outstandingLoans || 0),
      profit_margin: parseFloat(profitMargin.toFixed(2)),
      revenue_trend: 12.5,
    });
  }),
);

// GET - Comparison report
router.get(
  "/comparison",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;

    const startDate = fromDate ? new Date(fromDate) : undefined;
    if (startDate) startDate.setHours(0, 0, 0, 0);

    const endDate = toDate ? new Date(toDate) : undefined;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const whereClause: any = {};
    if (startDate) whereClause.created_at = { [Op.gte]: startDate };
    if (endDate)
      whereClause.created_at = { ...whereClause.created_at, [Op.lte]: endDate };

    const sales = await Sale.findAll({ where: whereClause });
    const totalRevenue = sales.reduce(
      (sum, s) => sum + Number(s.total_amount),
      0,
    );

    const days =
      fromDate && toDate
        ? Math.ceil(
            (endDate!.getTime() - startDate!.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 30;
    const dailyAverage = totalRevenue / Math.max(days, 1);

    res.json({
      daily_average: dailyAverage,
      weekly_average: dailyAverage * 7,
      monthly_average: dailyAverage * 30,
      total_transactions: sales.length,
    });
  }),
);

// GET - Daily revenue report
router.get(
  "/daily-revenue",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : new Date();
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 7);

    const results = [];
    let current = new Date(fromDate);
    current.setHours(0, 0, 0, 0);

    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const revenue = await Sale.sum("total_amount", {
        where: { created_at: { [Op.between]: [dayStart, dayEnd] } },
      });

      results.push({
        date: current.toISOString().split("T")[0],
        revenue: Number(revenue || 0),
      });

      current.setDate(current.getDate() + 1);
    }

    res.json(results);
  }),
);

// GET - Top products report
router.get(
  "/top-products",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : undefined;
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    const startDate = fromDate ? new Date(fromDate) : undefined;
    if (startDate) startDate.setHours(0, 0, 0, 0);

    const endDate = toDate ? new Date(toDate) : undefined;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const saleWhere: any = {};
    if (startDate) saleWhere.created_at = { [Op.gte]: startDate };
    if (endDate)
      saleWhere.created_at = { ...saleWhere.created_at, [Op.lte]: endDate };

    const topProducts = await SaleItem.findAll({
      attributes: [
        "product_id",
        [fn("SUM", col("quantity")), "total_quantity"],
      ],
      include: [
        { model: Product, as: "product", attributes: ["id", "name"] },
        { model: Sale, as: "sale", where: saleWhere, required: true },
      ],
      group: ["product_id", "product.id"],
      order: [[fn("SUM", col("quantity")), "DESC"]],
      limit,
    });

    const result = topProducts.map((item: any) => ({
      id: item.product_id,
      name: item.product?.name || "Unknown",
      quantity: parseInt(item.dataValues.total_quantity),
    }));

    res.json(result);
  }),
);

// GET - Stock entries report
router.get(
  "/stock-entries",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : new Date();
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 7);

    const startDatetime = new Date(fromDate);
    startDatetime.setHours(0, 0, 0, 0);
    const endDatetime = new Date(toDate);
    endDatetime.setHours(23, 59, 59, 999);

    const stockEntries: any[] = [];

    // Get stock-out from sales
    const sales = await Sale.findAll({
      where: { created_at: { [Op.between]: [startDatetime, endDatetime] } },
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
      ],
    });

    for (const sale of sales) {
      const items = (sale as any).items || [];
      for (const item of items) {
        const product = (item as any).product;
        stockEntries.push({
          id: `sale-${sale.id}-${item.id}`,
          date: sale.created_at,
          product_name: product?.name || "Unknown",
          sku: product?.sku || "N/A",
          quantity_in: 0,
          quantity: -Number(item.quantity),
          unit_cost: Number(item.unit_price),
          reference: `Sale #${sale.invoice_number}`,
          notes: `Sold to ${sale.customer_name || "Walk-in Customer"}`,
        });
      }
    }

    // Get stock-in from purchase orders
    const purchaseOrders = await PurchaseOrder.findAll({
      where: {
        order_date: { [Op.between]: [startDatetime, endDatetime] },
        status: "completed",
      },
      include: [
        {
          model: PurchaseOrderItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
      ],
    });

    for (const po of purchaseOrders) {
      const items = (po as any).items || [];
      for (const item of items) {
        const product = (item as any).product;
        stockEntries.push({
          id: `po-${po.id}-${item.id}`,
          date: po.order_date,
          product_name: product?.name || "Unknown",
          sku: product?.sku || "N/A",
          quantity_in:
            Number(item.quantity_received) || Number(item.quantity_ordered),
          unit_cost: Number(item.unit_cost),
          reference: `PO #${po.order_number}`,
          notes: `Purchase from ${po.supplier}`,
        });
      }
    }

    // Get stock-in from legacy purchases
    const purchases = await Purchase.findAll({
      where: { created_at: { [Op.between]: [startDatetime, endDatetime] } },
      include: [
        {
          model: PurchaseItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
      ],
    });

    for (const purchase of purchases) {
      const items = (purchase as any).items || [];
      for (const item of items) {
        const product = (item as any).product;
        stockEntries.push({
          id: `pur-${purchase.id}-${item.id}`,
          date: purchase.created_at,
          product_name: product?.name || "Unknown",
          sku: product?.sku || "N/A",
          quantity_in: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          reference: `Purchase #${purchase.id}`,
          notes: `From ${purchase.supplier_name || "Unknown"}`,
        });
      }
    }

    stockEntries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    res.json(stockEntries.slice(0, 100));
  }),
);

// GET - Profit report
router.get(
  "/profit",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : new Date();
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 30);

    const startDatetime = new Date(fromDate);
    startDatetime.setHours(0, 0, 0, 0);
    const endDatetime = new Date(toDate);
    endDatetime.setHours(23, 59, 59, 999);

    const saleItems = await SaleItem.findAll({
      attributes: [
        "product_id",
        [fn("SUM", col("quantity")), "total_quantity"],
        [fn("SUM", literal("quantity * unit_price")), "total_revenue"],
      ],
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "sku", "cost"],
        },
        {
          model: Sale,
          as: "sale",
          where: { created_at: { [Op.between]: [startDatetime, endDatetime] } },
          required: true,
        },
      ],
      group: ["product_id", "product.id"],
    });

    const profitData = [];

    for (const item of saleItems) {
      const product = (item as any).product;
      const unitCost = product ? Number(product.cost) : 0;
      const totalQuantity = parseFloat((item as any).dataValues.total_quantity);
      const revenue = parseFloat((item as any).dataValues.total_revenue);
      const totalCost = unitCost * totalQuantity;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      profitData.push({
        id: item.product_id,
        name: product?.name || "Unknown",
        sku: product?.sku || "N/A",
        quantity_sold: Math.floor(totalQuantity),
        quantity: Math.floor(totalQuantity),
        revenue: parseFloat(revenue.toFixed(2)),
        cost: parseFloat(totalCost.toFixed(2)),
        total_cost: parseFloat(totalCost.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        margin: parseFloat(margin.toFixed(2)),
      });
    }

    profitData.sort((a, b) => b.profit - a.profit);

    res.json(profitData);
  }),
);

// GET - Monthly stock report
router.get(
  "/monthly-stock",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const toDate = req.query.to_date
      ? new Date(req.query.to_date as string)
      : new Date();
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date as string)
      : new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 30);

    const startDatetime = new Date(fromDate);
    startDatetime.setHours(0, 0, 0, 0);
    const endDatetime = new Date(toDate);
    endDatetime.setHours(23, 59, 59, 999);

    const currentMonth = toDate.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    const products = await Product.findAll();

    const sales = await Sale.findAll({
      where: { created_at: { [Op.between]: [startDatetime, endDatetime] } },
      include: [{ model: SaleItem, as: "items" }],
    });

    const purchases = await Purchase.findAll({
      where: { created_at: { [Op.between]: [startDatetime, endDatetime] } },
      include: [{ model: PurchaseItem, as: "items" }],
    });

    const purchaseOrders = await PurchaseOrder.findAll({
      where: {
        order_date: { [Op.between]: [startDatetime, endDatetime] },
        status: "completed",
      },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    const report = [];

    for (const product of products) {
      const stock = await Stock.findOne({ where: { product_id: product.id } });
      const currentStock = stock ? Number(stock.quantity) : 0;

      let stockOut = 0;
      for (const sale of sales) {
        const items = (sale as any).items || [];
        for (const item of items) {
          if (item.product_id === product.id) {
            stockOut += Number(item.quantity);
          }
        }
      }

      let stockIn = 0;
      for (const purchase of purchases) {
        const items = (purchase as any).items || [];
        for (const item of items) {
          if (item.product_id === product.id) {
            stockIn += Number(item.quantity);
          }
        }
      }

      for (const po of purchaseOrders) {
        const items = (po as any).items || [];
        for (const item of items) {
          if (item.product_id === product.id) {
            stockIn +=
              Number(item.quantity_received) || Number(item.quantity_ordered);
          }
        }
      }

      const openingStock = currentStock + stockOut - stockIn;

      const latestPurchase = await PurchaseItem.findOne({
        where: { product_id: product.id },
        include: [{ model: Purchase, as: "purchase" }],
        order: [[{ model: Purchase, as: "purchase" }, "created_at", "DESC"]],
      });

      const unitCost = latestPurchase
        ? Number(latestPurchase.unit_cost)
        : Number(product.cost);
      const openingValue = openingStock * unitCost;
      const closingValue = currentStock * unitCost;

      if (openingStock > 0 || currentStock > 0 || stockIn > 0 || stockOut > 0) {
        report.push({
          month: currentMonth,
          product_name: product.name,
          sku: product.sku,
          opening_stock: Math.floor(openingStock),
          stock_in: Math.floor(stockIn),
          stock_out: Math.floor(stockOut),
          closing_stock: Math.floor(currentStock),
          opening_value: parseFloat(openingValue.toFixed(2)),
          closing_value: parseFloat(closingValue.toFixed(2)),
          unit_cost: parseFloat(unitCost.toFixed(2)),
        });
      }
    }

    report.sort((a, b) => a.product_name.localeCompare(b.product_name));

    res.json(report);
  }),
);

export default router;
