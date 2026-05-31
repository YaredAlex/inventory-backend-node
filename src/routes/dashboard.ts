import { Router, Request, Response } from "express";
import { Sequelize, Op } from "sequelize";
import { database } from "../database.js";
import { Stock } from "../models/stock.js";
import { Product } from "../models/product.js";
import { Sale } from "../models/sale.js";
import { Alert } from "../models/alert.js";
import { Branch } from "../models/branch.js";
import { requireAuth } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

const router = Router();
interface AuthenticatedRequest extends Request {
  user?: any;
}
// Apply authentication to all dashboard routes
router.use(requireAuth);

// GET dashboard statistics
// Supports both /api/dashboard and /api/dashboard/
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = (req as any).user;
    const sequelize = database.sequelize!;

    // Determine branch filter based on user role
    let branchId: number | null = null;
    if (currentUser.role === "salesman") {
      branchId = currentUser.branch_id;
    }

    // Build branch filter condition
    const branchFilter = branchId ? { branch_id: branchId } : {};

    // 1. Get low stock products
    const lowStockQuery = await Stock.findAll({
      where: {
        ...branchFilter,
        [Op.and]: sequelize.literal("quantity <= reorder_level"),
      },
      limit: 10,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["name", "sku"],
        },
        {
          model: Branch,
          as: "branch",
          attributes: ["id", "name"],
        },
      ],
    });

    const lowStockProducts = lowStockQuery.map((stock) => ({
      product_name: (stock as any).product?.name || "Unknown",
      sku: (stock as any).product?.sku || "N/A",
      current_stock: Number(stock.quantity),
      reorder_level: Number(stock.reorder_level),
      branch_id: stock.branch_id,
      branch_name: (stock as any).branch?.name || "Unknown",
    }));

    // 2. Get today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const salesQuery = await Sale.findAll({
      where: {
        ...branchFilter,
        created_at: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      },
    });

    const todaySales = salesQuery;
    const todayRevenue = todaySales.reduce(
      (sum, sale) => sum + Number(sale.total_amount),
      0,
    );

    // 3. Get total active products count
    const productsCount = await Product.count({
      where: { active: true },
    });

    // 4. Get branches count (admin only)
    let branchesCount = 0;
    if (currentUser.role === "admin") {
      branchesCount = await Branch.count();
    } else {
      // For non-admin, count is 1 if they have a branch, otherwise 0
      branchesCount = currentUser.branch_id ? 1 : 0;
    }

    // 5. Get active alerts count
    const alertFilter: any = { resolved: false };
    if (branchId) {
      alertFilter.branch_id = branchId;
    }
    const alertsCount = await Alert.count({ where: alertFilter });

    // Return dashboard data
    res.json({
      total_products: productsCount,
      total_branches: branchesCount,
      low_stock_alerts: lowStockProducts.length,
      low_stock_products: lowStockProducts,
      today_sales: {
        count: todaySales.length,
        revenue: todayRevenue,
      },
      active_alerts: alertsCount,
      // Additional useful stats
      user_info: {
        role: currentUser.role,
        name: currentUser.name,
        branch_id: currentUser.branch_id,
      },
    });
  }),
);

// GET recent sales for dashboard
router.get(
  "/recent-sales",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 10;

    const branchId =
      currentUser.role === "salesman" ? currentUser.branch_id : null;
    const branchFilter = branchId ? { branch_id: branchId } : {};

    const recentSales = await Sale.findAll({
      where: branchFilter,
      limit,
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "invoice_number",
        "customer_name",
        "total_amount",
        "created_at",
        "status",
      ],
    });

    res.json({
      recent_sales: recentSales.map((sale) => ({
        id: sale.id,
        invoice_number: sale.invoice_number,
        customer_name: sale.customer_name || "Walk-in Customer",
        total_amount: Number(sale.total_amount),
        created_at: sale.created_at,
        status: sale.status,
      })),
    });
  }),
);

// GET chart data (sales over time)
// router.get(
//   "/chart-data",
//   asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
//     const currentUser = (req as any).user;
//     const days = parseInt(req.query.days as string) || 7;

//     const branchId =
//       currentUser.role === "salesman" ? currentUser.branch_id : null;
//     const branchFilter = branchId ? { branch_id: branchId } : {};

//     // Calculate date range
//     const endDate = new Date();
//     endDate.setHours(23, 59, 59, 999);
//     const startDate = new Date();
//     startDate.setDate(startDate.getDate() - days);
//     startDate.setHours(0, 0, 0, 0);

//     const sales = await Sale.findAll({
//       where: {
//         ...branchFilter,
//         created_at: {
//           [Op.gte]: startDate,
//           [Op.lte]: endDate,
//         },
//       },
//       attributes: ["created_at", "total_amount"],
//     });

//     // Define the type explicitly
//     const salesByDate: Record<string, { count: number; revenue: number }> = {};

//     for (let i = 0; i <= days; i++) {
//       const date = new Date(startDate);
//       date.setDate(startDate.getDate() + i);
//       const dateKey = date.toISOString().split("T")[0];
//       salesByDate[dateKey] = { count: 0, revenue: 0 };
//     }

//     for (const sale of sales) {
//       const dateKey = sale.created_at.toISOString().split("T")[0];
//       // TypeScript now knows dateKey is a valid key
//       if (salesByDate[dateKey]) {
//         salesByDate[dateKey].count++;
//         salesByDate[dateKey].revenue += Number(sale.total_amount);
//       }
//     }

//     const chartData = Object.entries(salesByDate).map(([date, data]) => ({
//       date,
//       count: data.count,
//       revenue: data.revenue,
//     }));

//     res.json({
//       chart_data: chartData,
//       summary: {
//         total_sales: chartData.reduce((sum, d) => sum + d.count, 0),
//         total_revenue: chartData.reduce((sum, d) => sum + d.revenue, 0),
//         average_daily_revenue:
//           chartData.reduce((sum, d) => sum + d.revenue, 0) / days,
//       },
//     });
//   }),
// );

// GET top selling products
router.get(
  "/top-products",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 5;
    const days = parseInt(req.query.days as string) || 30;

    const branchId =
      currentUser.role === "salesman" ? currentUser.branch_id : null;
    const branchFilter = branchId ? { branch_id: branchId } : {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // This would require joining SaleItem and Product tables
    // For now, return placeholder data
    res.json({
      top_products: [],
      period_days: days,
      note: "Implementation requires SaleItem and Product relationship",
    });
  }),
);

export default router;
