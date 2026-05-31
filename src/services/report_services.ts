import { Sequelize, Op, fn, col, literal } from "sequelize";
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
import { User } from "../models/user.js";
import { Branch } from "../models/branch.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SalesReportResult {
  report_type: string;
  date_range: { start_date: string; end_date: string };
  summary: {
    total_sales: number;
    total_revenue: number;
    average_sale_value: number;
    total_profit: number;
    profit_margin: number;
    loan_repayments: number;
    purchase_costs: number;
    net_income: number;
  };
  best_selling_products: any[];
  slow_moving_products: any[];
}

export class ReportService {
  static getDateRange(reportType: "weekly" | "monthly"): DateRange {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (reportType === "weekly") {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  static async generateSalesReport(
    sequelize: Sequelize,
    reportType: "weekly" | "monthly",
    branchId?: number | null,
    includeLoanRepayments: boolean = true,
    includePurchases: boolean = true,
  ): Promise<SalesReportResult> {
    const { startDate, endDate } = this.getDateRange(reportType);

    // Build where clause
    const saleWhere: any = {
      created_at: { [Op.between]: [startDate, endDate] },
    };
    if (branchId) saleWhere.branch_id = branchId;

    const sales = await Sale.findAll({ where: saleWhere });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce(
      (sum, sale) => sum + Number(sale.total_amount),
      0,
    );
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Calculate profit
    let totalProfit = 0;
    for (const sale of sales) {
      const items = await SaleItem.findAll({
        where: { sale_id: sale.id },
        include: [{ model: Product, as: "product" }],
      });

      for (const item of items) {
        const product = (item as any).product;
        const costPerUnit = product ? Number(product.cost) : 0;
        const profitPerItem =
          (Number(item.unit_price) - costPerUnit) * Number(item.quantity);
        totalProfit += profitPerItem;
      }
    }

    // Best selling products
    const bestSellingQuery = await SaleItem.findAll({
      attributes: [
        "product_id",
        [fn("SUM", col("quantity")), "total_quantity"],
        [fn("SUM", literal("quantity * unit_price")), "total_revenue"],
      ],
      include: [
        { model: Product, as: "product", attributes: ["id", "name", "sku"] },
        { model: Sale, as: "sale", where: saleWhere, required: true },
      ],
      group: ["product_id", "product.id"],
      order: [[fn("SUM", col("quantity")), "DESC"]],
      limit: 10,
    });

    const bestSellingProducts = bestSellingQuery.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product?.name || "Unknown",
      product_sku: item.product?.sku || "N/A",
      quantity_sold: parseInt(item.dataValues.total_quantity),
      revenue: parseFloat(item.dataValues.total_revenue),
    }));

    // Slow moving products
    // Slow moving products - Alternative approach without HAVING
    const productsWithSales = await SaleItem.findAll({
      attributes: [
        "product_id",
        [fn("SUM", col("quantity")), "total_quantity"],
      ],
      include: [
        {
          model: Sale,
          as: "sale",
          where: { created_at: { [Op.between]: [startDate, endDate] } },
          required: true,
          attributes: [],
        },
      ],
      where: branchId ? { "$sale.branch_id$": branchId } : {},
      group: ["product_id"],
      having: literal("SUM(quantity) < 5"),
    });

    const productIdsWithLowSales = productsWithSales.map(
      (p: any) => p.product_id,
    );

    // Get products that have low sales or no sales
    const slowMovingQuery = await Product.findAll({
      where: {
        id: { [Op.in]: productIdsWithLowSales },
      },
      limit: 10,
    });

    const slowMovingProducts = [];
    for (const product of slowMovingQuery) {
      const items = await SaleItem.findAll({
        where: { product_id: product.id },
        include: [
          {
            model: Sale,
            as: "sale",
            where: { created_at: { [Op.between]: [startDate, endDate] } },
            required: false,
          },
        ],
      });

      const totalQuantity = items.reduce(
        (sum, item) => sum + Number(item.quantity),
        0,
      );
      const totalRevenue = items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
        0,
      );

      slowMovingProducts.push({
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity_sold: totalQuantity,
        revenue: totalRevenue,
      });
    }

    // Loan repayments
    let loanRepaymentsTotal = 0;
    if (includeLoanRepayments) {
      const loanPayments = await LoanPayment.findAll({
        where: { payment_date: { [Op.between]: [startDate, endDate] } },
      });
      loanRepaymentsTotal = loanPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
    }

    // Purchase costs
    let purchaseCostsTotal = 0;
    if (includePurchases) {
      const purchaseOrders = await PurchaseOrder.findAll({
        where: {
          order_date: { [Op.between]: [startDate, endDate] },
          status: "completed",
        },
      });
      purchaseCostsTotal = purchaseOrders.reduce(
        (sum, po) => sum + Number(po.total_amount),
        0,
      );
    }

    return {
      report_type: reportType,
      date_range: {
        start_date: startDate.toISOString().split("T")[0] || "undefined",
        end_date: endDate.toISOString().split("T")[0] || "undefined",
      },
      summary: {
        total_sales: totalSales,
        total_revenue: totalRevenue,
        average_sale_value: averageSaleValue,
        total_profit: totalProfit,
        profit_margin:
          totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        loan_repayments: loanRepaymentsTotal,
        purchase_costs: purchaseCostsTotal,
        net_income: totalRevenue + loanRepaymentsTotal - purchaseCostsTotal,
      },
      best_selling_products: bestSellingProducts,
      slow_moving_products: slowMovingProducts,
    };
  }

  static async generatePurchaseReport(
    sequelize: Sequelize,
    fromDate?: Date,
    toDate?: Date,
    supplier?: string,
  ): Promise<any> {
    const endDate = toDate || new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = fromDate || new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const poWhere: any = {
      order_date: { [Op.between]: [startDate, endDate] },
    };
    if (supplier) poWhere.supplier = { [Op.like]: `%${supplier}%` };

    const purchaseOrders = await PurchaseOrder.findAll({ where: poWhere });

    const purchaseWhere: any = {
      created_at: { [Op.between]: [startDate, endDate] },
    };
    if (supplier) purchaseWhere.supplier_name = { [Op.like]: `%${supplier}%` };

    const purchases = await Purchase.findAll({ where: purchaseWhere });

    const totalPurchaseCost = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.total_amount),
      0,
    );
    const totalLegacyCost = purchases.reduce(
      (sum, p) => sum + Number(p.total_amount),
      0,
    );

    const supplierTotals: Record<string, number> = {};
    for (const po of purchaseOrders) {
      supplierTotals[po.supplier] =
        (supplierTotals[po.supplier] || 0) + Number(po.total_amount);
    }
    for (const p of purchases) {
      if (p.supplier_name) {
        supplierTotals[p.supplier_name] =
          (supplierTotals[p.supplier_name] || 0) + Number(p.total_amount);
      }
    }

    const topItems = await PurchaseOrderItem.findAll({
      attributes: [
        "product_id",
        [fn("SUM", col("quantity_received")), "total_quantity"],
        [fn("SUM", col("total_cost")), "total_cost"],
      ],
      include: [
        { model: Product, as: "product", attributes: ["id", "name"] },
        {
          model: PurchaseOrder,
          as: "purchase_order",
          where: {
            order_date: { [Op.between]: [startDate, endDate] },
            status: "completed",
          },
          required: true,
        },
      ],
      group: ["product_id", "product.id"],
      order: [[fn("SUM", col("total_cost")), "DESC"]],
      limit: 10,
    });

    const topItemsList = [];
    for (const item of topItems) {
      const product = (item as any).product;
      const totalQuantity = parseFloat((item as any).dataValues.total_quantity);
      const totalCost = parseFloat((item as any).dataValues.total_cost);

      topItemsList.push({
        product_id: item.product_id,
        product_name: product?.name || "Unknown",
        quantity: totalQuantity,
        total_cost: totalCost,
        average_cost: totalQuantity > 0 ? totalCost / totalQuantity : 0,
      });
    }

    return {
      date_range: {
        from_date: startDate.toISOString().split("T")[0],
        to_date: endDate.toISOString().split("T")[0],
      },
      summary: {
        total_purchase_orders: purchaseOrders.length,
        total_purchase_cost: totalPurchaseCost,
        total_legacy_purchases: purchases.length,
        total_legacy_cost: totalLegacyCost,
        total_all_purchases: totalPurchaseCost + totalLegacyCost,
        average_order_value:
          purchaseOrders.length > 0
            ? totalPurchaseCost / purchaseOrders.length
            : 0,
      },
      supplier_breakdown: Object.entries(supplierTotals)
        .map(([supplierName, amount]) => ({
          supplier: supplierName,
          total_amount: amount,
        }))
        .sort((a, b) => b.total_amount - a.total_amount),
      top_items: topItemsList,
      purchase_orders: purchaseOrders.slice(0, 20).map((po) => ({
        order_number: po.order_number,
        supplier: po.supplier,
        order_date: po.order_date,
        total_amount: Number(po.total_amount),
        status: po.status,
        items_count: 0,
      })),
    };
  }

  static async generateLoanReport(
    sequelize: Sequelize,
    fromDate?: Date,
    toDate?: Date,
    status?: string,
    customerName?: string,
  ): Promise<any> {
    const endDate = toDate || new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = fromDate || new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const loanWhere: any = {
      created_at: { [Op.between]: [startDate, endDate] },
    };
    if (status) loanWhere.status = status;
    if (customerName)
      loanWhere.customer_name = { [Op.like]: `%${customerName}%` };

    const loans = await Loan.findAll({ where: loanWhere });

    const payments = await LoanPayment.findAll({
      where: { payment_date: { [Op.between]: [startDate, endDate] } },
    });

    const totalLoansAmount = loans.reduce(
      (sum, loan) => sum + Number(loan.total_amount),
      0,
    );
    const totalPayments = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const now = new Date();
    const overdueLoans = await Loan.findAll({
      where: {
        due_date: { [Op.lt]: now },
        remaining_amount: { [Op.gt]: 0 },
        status: { [Op.ne]: "settled" },
      },
    });

    const paymentMethods: Record<string, number> = {};
    for (const payment of payments) {
      const method = payment.payment_method;
      paymentMethods[method] =
        (paymentMethods[method] || 0) + Number(payment.amount);
    }

    const totalOutstandingAmount = await Loan.sum("remaining_amount", {
      where: {
        remaining_amount: { [Op.gt]: 0 },
        status: { [Op.ne]: "settled" },
      },
    });

    return {
      date_range: {
        from_date: startDate.toISOString().split("T")[0],
        to_date: endDate.toISOString().split("T")[0],
      },
      summary: {
        total_loans_issued: loans.length,
        total_loan_amount: totalLoansAmount,
        total_repayments: totalPayments,
        net_outstanding_change: totalLoansAmount - totalPayments,
        total_outstanding_loans: loans.filter(
          (l) => Number(l.remaining_amount) > 0 && l.status !== "settled",
        ).length,
        total_outstanding_amount: Number(totalOutstandingAmount || 0),
        overdue_loans_count: overdueLoans.length,
        overdue_amount: overdueLoans.reduce(
          (sum, loan) => sum + Number(loan.remaining_amount),
          0,
        ),
        repayment_rate:
          totalLoansAmount > 0 ? (totalPayments / totalLoansAmount) * 100 : 0,
      },
      payment_method_breakdown: Object.entries(paymentMethods).map(
        ([method, amount]) => ({
          method,
          amount,
        }),
      ),
      loans_by_status: {
        active: await Loan.count({ where: { status: "active" } }),
        partially_paid: await Loan.count({
          where: { status: "partially_paid" },
        }),
        settled: await Loan.count({ where: { status: "settled" } }),
        overdue: overdueLoans.length,
        cancelled: await Loan.count({ where: { status: "cancelled" } }),
      },
      recent_loans: loans.slice(0, 20).map((loan) => ({
        loan_number: loan.loan_number,
        customer_name: loan.customer_name,
        total_amount: Number(loan.total_amount),
        paid_amount: Number(loan.paid_amount),
        remaining_amount: Number(loan.remaining_amount),
        due_date: loan.due_date,
        status: loan.status,
        days_overdue:
          Number(loan.remaining_amount) > 0
            ? Math.max(
                0,
                Math.floor(
                  (now.getTime() - loan.due_date.getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : 0,
      })),
      overdue_loans: overdueLoans.slice(0, 20).map((loan) => ({
        loan_number: loan.loan_number,
        customer_name: loan.customer_name,
        remaining_amount: Number(loan.remaining_amount),
        due_date: loan.due_date,
        days_overdue: Math.floor(
          (now.getTime() - loan.due_date.getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  }

  static async generateProfitLossReport(
    sequelize: Sequelize,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<any> {
    const endDate = toDate || new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = fromDate || new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const sales = await Sale.findAll({
      where: { created_at: { [Op.between]: [startDate, endDate] } },
    });
    const salesRevenue = sales.reduce(
      (sum, sale) => sum + Number(sale.total_amount),
      0,
    );

    const loanPayments = await LoanPayment.findAll({
      where: { payment_date: { [Op.between]: [startDate, endDate] } },
    });
    const loanRepaymentRevenue = loanPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const totalRevenue = salesRevenue + loanRepaymentRevenue;

    const purchaseOrders = await PurchaseOrder.findAll({
      where: {
        order_date: { [Op.between]: [startDate, endDate] },
        status: "completed",
      },
    });
    const purchaseCost = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.total_amount),
      0,
    );

    const legacyPurchases = await Purchase.findAll({
      where: { created_at: { [Op.between]: [startDate, endDate] } },
    });
    const legacyPurchaseCost = legacyPurchases.reduce(
      (sum, p) => sum + Number(p.total_amount),
      0,
    );
    const totalCogs = purchaseCost + legacyPurchaseCost;

    const grossProfit = totalRevenue - totalCogs;
    const grossMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const dailyBreakdown = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = await Sale.findAll({
        where: { created_at: { [Op.between]: [dayStart, dayEnd] } },
      });
      const daySalesRevenue = daySales.reduce(
        (sum, s) => sum + Number(s.total_amount),
        0,
      );

      const dayLoanPayments = await LoanPayment.findAll({
        where: { payment_date: { [Op.between]: [dayStart, dayEnd] } },
      });
      const dayLoanRevenue = dayLoanPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      const dayPurchases = await Purchase.findAll({
        where: { created_at: { [Op.between]: [dayStart, dayEnd] } },
      });
      const dayPurchaseCost = dayPurchases.reduce(
        (sum, p) => sum + Number(p.total_amount),
        0,
      );

      dailyBreakdown.push({
        date: currentDate.toISOString().split("T")[0],
        sales_revenue: daySalesRevenue,
        loan_repayments: dayLoanRevenue,
        total_revenue: daySalesRevenue + dayLoanRevenue,
        purchase_cost: dayPurchaseCost,
        gross_profit: daySalesRevenue + dayLoanRevenue - dayPurchaseCost,
        transactions_count: daySales.length,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      date_range: {
        from_date: startDate.toISOString().split("T")[0],
        to_date: endDate.toISOString().split("T")[0],
      },
      revenue: {
        sales_revenue: salesRevenue,
        loan_repayments: loanRepaymentRevenue,
        total_revenue: totalRevenue,
      },
      cost_of_goods_sold: {
        purchase_orders: purchaseCost,
        legacy_purchases: legacyPurchaseCost,
        total_cogs: totalCogs,
      },
      profit: {
        gross_profit: grossProfit,
        gross_margin_percentage: grossMargin,
      },
      summary: {
        total_sales_transactions: sales.length,
        total_loan_payments: loanPayments.length,
        total_purchases: purchaseOrders.length + legacyPurchases.length,
        average_transaction_value:
          sales.length > 0 ? salesRevenue / sales.length : 0,
        average_loan_payment:
          loanPayments.length > 0
            ? loanRepaymentRevenue / loanPayments.length
            : 0,
      },
      daily_breakdown: dailyBreakdown,
    };
  }

  static async getInventoryValuation(sequelize: Sequelize): Promise<any> {
    const inventoryItems = await Stock.findAll({
      include: [{ model: Product, as: "product", required: true }],
    });

    let totalValue = 0;
    const itemsDetail = [];

    for (const stock of inventoryItems) {
      const product = (stock as any).product;

      const latestPurchase = await PurchaseItem.findOne({
        where: { product_id: stock.product_id },
        include: [
          { model: Purchase, as: "purchase", order: [["created_at", "DESC"]] },
        ],
        order: [[{ model: Purchase, as: "purchase" }, "created_at", "DESC"]],
      });

      const unitCost = latestPurchase
        ? Number(latestPurchase.unit_cost)
        : product
          ? Number(product.cost)
          : 0;
      const itemValue = Number(stock.quantity) * unitCost;
      totalValue += itemValue;

      itemsDetail.push({
        product_id: stock.product_id,
        product_name: product?.name || "Unknown",
        sku: product?.sku || "N/A",
        quantity: Number(stock.quantity),
        unit_cost: unitCost,
        total_value: itemValue,
        reorder_level: Number(stock.reorder_level),
        status:
          Number(stock.quantity) <= Number(stock.reorder_level)
            ? "Low Stock"
            : "OK",
      });
    }

    return {
      total_inventory_value: totalValue,
      total_products_count: inventoryItems.length,
      low_stock_items: itemsDetail.filter(
        (item) => item.status === "Low Stock",
      ),
      items: itemsDetail,
    };
  }

  static async getDashboardSummary(sequelize: Sequelize): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = await Sale.findAll({
      where: { created_at: { [Op.between]: [todayStart, todayEnd] } },
    });
    const todaySalesRevenue = todaySales.reduce(
      (sum, s) => sum + Number(s.total_amount),
      0,
    );
    const todaySalesCount = todaySales.length;

    const todayLoanPayments = await LoanPayment.findAll({
      where: { payment_date: { [Op.between]: [todayStart, todayEnd] } },
    });
    const todayLoanRepayments = todayLoanPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const todayPurchases = await Purchase.findAll({
      where: { created_at: { [Op.between]: [todayStart, todayEnd] } },
    });
    const todayPurchaseCost = todayPurchases.reduce(
      (sum, p) => sum + Number(p.total_amount),
      0,
    );

    const activeLoans = await Loan.findAll({
      where: { status: { [Op.in]: ["active", "partially_paid"] } },
    });

    const now = new Date();
    const overdueLoans = await Loan.findAll({
      where: {
        due_date: { [Op.lt]: now },
        remaining_amount: { [Op.gt]: 0 },
        status: { [Op.ne]: "settled" },
      },
    });

    const lowStockItems = await Stock.count({
      where: literal("quantity <= reorder_level"),
    });

    return {
      today: {
        sales_revenue: todaySalesRevenue,
        sales_count: todaySalesCount,
        loan_repayments: todayLoanRepayments,
        purchase_cost: todayPurchaseCost,
        total_income: todaySalesRevenue + todayLoanRepayments,
        net_cash_flow:
          todaySalesRevenue + todayLoanRepayments - todayPurchaseCost,
        average_transaction:
          todaySalesCount > 0 ? todaySalesRevenue / todaySalesCount : 0,
      },
      current_status: {
        active_loans_count: activeLoans.length,
        active_loans_value: activeLoans.reduce(
          (sum, loan) => sum + Number(loan.remaining_amount),
          0,
        ),
        overdue_loans_count: overdueLoans.length,
        overdue_loans_value: overdueLoans.reduce(
          (sum, loan) => sum + Number(loan.remaining_amount),
          0,
        ),
        low_stock_items_count: lowStockItems,
      },
      quick_actions: [
        "Check overdue loans",
        "Review low stock items",
        "Generate weekly report",
      ],
    };
  }
}
