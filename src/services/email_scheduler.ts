import { Sequelize, Op } from "sequelize";
import { User, UserRole } from "../models/user.js";
import { Stock } from "../models/stock.js";
import { Product } from "../models/product.js";
import { Branch } from "../models/branch.js";
import { Alert } from "../models/alert.js";
import { Sale } from "../models/sale.js";
import { SaleItem } from "../models/sale_item.js";
import { SettingsService } from "./setting_service.js";
import { EmailService } from "./email_service.js";
import logger from "./logger.js";

export class EmailScheduler {
  /**
   * Get all active admin email addresses from users table
   */
  static async getAdminEmails(sequelize: Sequelize): Promise<string[]> {
    const adminUsers = await User.findAll({
      where: {
        role: UserRole.ADMIN,
        active: true,
      },
      attributes: ["email"],
    });

    const emails = adminUsers.map((user) => user.email);
    logger.info(`🔍 [SCHEDULER] Found admin emails: ${emails}`);
    return emails;
  }

  /**
   * Check for low stock and send email alerts to all admins
   */
  static async checkAndSendLowStockAlerts(sequelize: Sequelize): Promise<void> {
    try {
      // Get admin emails directly from users table
      const adminEmails = await this.getAdminEmails(sequelize);

      if (adminEmails.length === 0) {
        logger.info("No active admin users found");
        return;
      }

      // Check if low stock email notifications are enabled
      const lowStockEmail = await SettingsService.getSetting(
        sequelize,
        "notification",
        "low_stock_email",
      );

      if (!lowStockEmail) {
        logger.info("Low stock email notifications disabled");
        return;
      }

      const stocks = await Stock.findAll({
        where: sequelize.literal("quantity <= reorder_level"),
        include: [
          { model: Product, as: "product" },
          { model: Branch, as: "branch" },
        ],
      });

      if (stocks.length === 0) {
        logger.info("No low stock items found");
        return;
      }

      logger.info(
        `Found ${stocks.length} low stock items. Sending alerts to admins: ${adminEmails}`,
      );

      for (const stock of stocks) {
        const product = (stock as any).product as Product;
        const branch = (stock as any).branch as Branch;

        if (product && branch) {
          // Check if alert was already sent today
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          const existingAlert = await Alert.findOne({
            where: {
              product_id: product.id,
              branch_id: branch.id,
              created_at: { [Op.gte]: yesterday },
              message: { [Op.like]: "%low stock%" },
            },
          });

          if (!existingAlert) {
            // Send to all admin emails
            await EmailService.sendLowStockAlert({
              toEmails: adminEmails,
              productName: product.name,
              productSku: product.sku,
              currentStock: Number(stock.quantity),
              reorderLevel: Number(stock.reorder_level),
              branchName: branch.name,
            });

            const alert = await Alert.create({
              branch_id: stock.branch_id,
              product_id: stock.product_id,
              message: `Low stock alert sent to admins for ${product.name}`,
              resolved: false,
            });

            logger.info(`✅ Low stock alert sent for ${product.name}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to send low stock alerts: ${error}`);
    }
  }

  /**
   * Generate and send daily sales report to all admins
   */
  static async sendDailyReport(sequelize: Sequelize): Promise<void> {
    try {
      // Get admin emails directly from users table
      const adminEmails = await this.getAdminEmails(sequelize);

      if (adminEmails.length === 0) {
        logger.info("No active admin users found");
        return;
      }

      // Check if daily report emails are enabled
      const dailyReportEmail = await SettingsService.getSetting(
        sequelize,
        "notification",
        "daily_report_email",
      );

      if (!dailyReportEmail) {
        logger.info("Daily report email notifications disabled");
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const sales = await Sale.findAll({
        where: {
          created_at: {
            [Op.gte]: today,
            [Op.lt]: tomorrow,
          },
        },
        include: [
          {
            model: SaleItem,
            as: "items",
            include: [{ model: Product, as: "product" }],
          },
        ],
      });

      const totalSales = sales.length;
      const totalRevenue = sales.reduce(
        (sum, sale) => sum + Number(sale.total_amount),
        0,
      );
      const totalRefunds = sales.reduce(
        (sum, sale) => sum + Number(sale.refund_amount),
        0,
      );
      const netRevenue = totalRevenue - totalRefunds;

      // Get top products
      const productSales: Record<
        number,
        { name: string; quantity: number; revenue: number }
      > = {};

      for (const sale of sales) {
        const items = (sale as any).items as SaleItem[];
        for (const item of items) {
          const product = (item as any).product as Product;
          if (product) {
            if (!productSales[item.product_id]) {
              productSales[item.product_id] = {
                name: product.name,
                quantity: 0,
                revenue: 0,
              };
            }
            productSales[item.product_id].quantity += Number(item.quantity);
            productSales[item.product_id].revenue += Number(item.line_total);
          }
        }
      }

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Get low stock items
      const lowStockItems: Array<{
        product_name: string;
        current_stock: number;
        reorder_level: number;
      }> = [];
      const stocks = await Stock.findAll({
        where: sequelize.literal("quantity <= reorder_level"),
        limit: 5,
        include: [{ model: Product, as: "product" }],
      });

      for (const stock of stocks) {
        const product = (stock as any).product as Product;
        if (product) {
          lowStockItems.push({
            product_name: product.name,
            current_stock: Number(stock.quantity),
            reorder_level: Number(stock.reorder_level),
          });
        }
      }

      const reportData = {
        date: today.toISOString().split("T")[0],
        total_sales: totalSales,
        total_revenue: totalRevenue,
        total_refunds: totalRefunds,
        net_revenue: netRevenue,
        top_products: topProducts,
        low_stock_items: lowStockItems,
      };

      // Send to all admin emails
      await EmailService.sendDailyReport(adminEmails, reportData);
      logger.info(`✅ Daily report sent to ${adminEmails.length} admins`);
    } catch (error) {
      logger.error(`Failed to send daily report: ${error}`);
    }
  }
}
