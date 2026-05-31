import { Sequelize, Op } from "sequelize";
import { Alert } from "../models/alert.js";
import { Product } from "../models/product.js";
import { Branch } from "../models/branch.js";
import { Stock } from "../models/stock.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "./logger.js";

export interface AlertResponse {
  id: number;
  branch_id: number;
  branch_name: string;
  product_id: number;
  product_name: string;
  product_sku: string;
  message: string;
  created_at: Date;
  resolved: boolean;
  resolved_at: Date | null;
}

export interface LowStockItem {
  product_id: number;
  product_name: string;
  product_sku: string;
  current_stock: number;
  reorder_level: number;
  shortage: number;
  branch_id: number;
  branch_name: string;
  status: "out_of_stock" | "low_stock";
}

export interface LowStockSummary {
  total_low_stock_items: number;
  items: LowStockItem[];
}

export class AlertService {
  /**
   * Create a new alert
   */
  static async createAlert(
    sequelize: Sequelize,
    branchId: number,
    productId: number,
    message: string,
  ): Promise<Alert> {
    const alert = await Alert.create({
      branch_id: branchId,
      product_id: productId,
      message: message,
      resolved: false,
    });

    logger.info(`Alert created: ${message}`);
    return alert;
  }

  /**
   * Get alerts with product and branch names
   */
  static async getAlerts(
    sequelize: Sequelize,
    resolved: boolean = false,
    branchId?: number | null,
  ): Promise<AlertResponse[]> {
    const where: any = { resolved };
    if (branchId) {
      where.branch_id = branchId;
    }

    const alerts = await Alert.findAll({
      where,
      order: [["created_at", "DESC"]],
    });

    const result: AlertResponse[] = [];

    for (const alert of alerts) {
      const product = await Product.findByPk(alert.product_id);
      const branch = await Branch.findByPk(alert.branch_id);

      result.push({
        id: alert.id,
        branch_id: alert.branch_id,
        branch_name: branch?.name || "Unknown Branch",
        product_id: alert.product_id,
        product_name: product?.name || "Unknown Product",
        product_sku: product?.sku || "N/A",
        message: alert.message,
        created_at: alert.created_at,
        resolved: alert.resolved,
        resolved_at: alert.resolved_at,
      });
    }

    return result;
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(
    sequelize: Sequelize,
    alertId: number,
  ): Promise<Alert | null> {
    const alert = await Alert.findByPk(alertId);

    if (!alert) {
      return null;
    }

    alert.resolved = true;
    alert.resolved_at = new Date();
    await alert.save();

    logger.info(`Alert resolved: ID ${alertId}`);
    return alert;
  }

  /**
   * Check all stock items and create alerts for low stock and out of stock
   */
  static async checkLowStockAndCreateAlerts(
    sequelize: Sequelize,
  ): Promise<number> {
    const stocks = await Stock.findAll();
    let alertsCreated = 0;

    for (const stock of stocks) {
      const product = await Product.findByPk(stock.product_id);
      const branch = await Branch.findByPk(stock.branch_id);

      if (!product || !branch) {
        continue;
      }

      const currentQty = Number(stock.quantity) || 0;
      const reorderLevel = Number(stock.reorder_level) || 0;

      // Check for out of stock
      if (currentQty <= 0) {
        const existingAlert = await Alert.findOne({
          where: {
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            resolved: false,
            message: { [Op.like]: "%out of stock%" },
          },
        });

        if (!existingAlert) {
          const message = `Out of stock: ${product.name} (SKU: ${product.sku}) is out of stock at ${branch.name}.`;
          await Alert.create({
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            message: message,
            resolved: false,
          });
          alertsCreated++;
        }
      }
      // Check for low stock
      else if (currentQty <= reorderLevel) {
        const existingAlert = await Alert.findOne({
          where: {
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            resolved: false,
            message: { [Op.like]: "%low stock%" },
          },
        });

        if (!existingAlert) {
          const message = `Low stock alert: ${product.name} (SKU: ${product.sku}) has only ${currentQty} units remaining at ${branch.name}. Reorder level is ${reorderLevel}.`;
          await Alert.create({
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            message: message,
            resolved: false,
          });
          alertsCreated++;
        }
      }
    }

    if (alertsCreated > 0) {
      logger.info(`Created ${alertsCreated} low stock alerts`);
    }

    return alertsCreated;
  }

  /**
   * Auto-resolve alerts for products that are no longer low stock or out of stock
   */
  static async autoResolveAlerts(sequelize: Sequelize): Promise<number> {
    const unresolvedAlerts = await Alert.findAll({
      where: { resolved: false },
    });

    let resolvedCount = 0;

    for (const alert of unresolvedAlerts) {
      const stock = await Stock.findOne({
        where: {
          branch_id: alert.branch_id,
          product_id: alert.product_id,
        },
      });

      if (!stock) {
        continue;
      }

      const currentQty = Number(stock.quantity) || 0;
      const reorderLevel = Number(stock.reorder_level) || 0;

      if (
        alert.message.toLowerCase().includes("out of stock") &&
        currentQty > 0
      ) {
        alert.resolved = true;
        alert.resolved_at = new Date();
        await alert.save();
        resolvedCount++;
      } else if (
        alert.message.toLowerCase().includes("low stock") &&
        currentQty > reorderLevel
      ) {
        alert.resolved = true;
        alert.resolved_at = new Date();
        await alert.save();
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      logger.info(`Auto-resolved ${resolvedCount} alerts`);
    }

    return resolvedCount;
  }

  /**
   * Get summary of all low stock items (including out of stock)
   */
  static async getLowStockSummary(
    sequelize: Sequelize,
    branchId?: number | null,
  ): Promise<LowStockSummary> {
    const where: any = {
      [Op.and]: sequelize.literal("quantity <= reorder_level"),
    };

    if (branchId) {
      where.branch_id = branchId;
    }

    const lowStockItems = await Stock.findAll({
      where,
      include: [
        { model: Product, as: "product" },
        { model: Branch, as: "branch" },
      ],
    });

    const result: LowStockItem[] = [];

    for (const stock of lowStockItems) {
      const product = (stock as any).product;
      const branch = (stock as any).branch;

      if (product && branch) {
        const currentStock = Number(stock.quantity) || 0;
        const reorderLevel = Number(stock.reorder_level) || 0;

        result.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          current_stock: currentStock,
          reorder_level: reorderLevel,
          shortage:
            currentStock < reorderLevel ? reorderLevel - currentStock : 0,
          branch_id: stock.branch_id,
          branch_name: branch.name,
          status: currentStock <= 0 ? "out_of_stock" : "low_stock",
        });
      }
    }

    // Sort: out of stock first, then by current stock ascending
    result.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "out_of_stock" ? -1 : 1;
      }
      return a.current_stock - b.current_stock;
    });

    return {
      total_low_stock_items: result.length,
      items: result,
    };
  }

  /**
   * Get alert count by status
   */
  static async getAlertCount(
    sequelize: Sequelize,
    branchId?: number | null,
  ): Promise<{ unresolved: number; resolved: number; total: number }> {
    const where: any = {};
    if (branchId) {
      where.branch_id = branchId;
    }

    const unresolved = await Alert.count({
      where: { ...where, resolved: false },
    });

    const resolved = await Alert.count({
      where: { ...where, resolved: true },
    });

    return {
      unresolved,
      resolved,
      total: unresolved + resolved,
    };
  }

  /**
   * Delete old resolved alerts
   */
  static async cleanupOldAlerts(
    sequelize: Sequelize,
    daysOld: number = 30,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleted = await Alert.destroy({
      where: {
        resolved: true,
        resolved_at: { [Op.lte]: cutoffDate },
      },
    });

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old resolved alerts`);
    }

    return deleted;
  }

  /**
   * Get unresolved alerts for a specific product
   */
  static async getProductAlerts(
    sequelize: Sequelize,
    productId: number,
    branchId?: number | null,
  ): Promise<AlertResponse[]> {
    const where: any = {
      product_id: productId,
      resolved: false,
    };

    if (branchId) {
      where.branch_id = branchId;
    }

    const alerts = await Alert.findAll({
      where,
      order: [["created_at", "DESC"]],
    });

    const result: AlertResponse[] = [];

    for (const alert of alerts) {
      const product = await Product.findByPk(alert.product_id);
      const branch = await Branch.findByPk(alert.branch_id);

      result.push({
        id: alert.id,
        branch_id: alert.branch_id,
        branch_name: branch?.name || "Unknown Branch",
        product_id: alert.product_id,
        product_name: product?.name || "Unknown Product",
        product_sku: product?.sku || "N/A",
        message: alert.message,
        created_at: alert.created_at,
        resolved: alert.resolved,
        resolved_at: alert.resolved_at,
      });
    }

    return result;
  }

  /**
   * Bulk resolve alerts for a product
   */
  static async bulkResolveProductAlerts(
    sequelize: Sequelize,
    productId: number,
    branchId?: number | null,
  ): Promise<number> {
    const where: any = {
      product_id: productId,
      resolved: false,
    };

    if (branchId) {
      where.branch_id = branchId;
    }

    const alerts = await Alert.findAll({ where });
    let resolvedCount = 0;

    for (const alert of alerts) {
      alert.resolved = true;
      alert.resolved_at = new Date();
      await alert.save();
      resolvedCount++;
    }

    if (resolvedCount > 0) {
      logger.info(
        `Bulk resolved ${resolvedCount} alerts for product ${productId}`,
      );
    }

    return resolvedCount;
  }

  /**
   * Get alerts by branch
   */
  static async getAlertsByBranch(
    sequelize: Sequelize,
    branchId: number,
    resolved: boolean = false,
  ): Promise<AlertResponse[]> {
    return await this.getAlerts(sequelize, resolved, branchId);
  }

  /**
   * Get critical alerts (out of stock)
   */
  static async getCriticalAlerts(
    sequelize: Sequelize,
    branchId?: number | null,
  ): Promise<AlertResponse[]> {
    const allAlerts = await this.getAlerts(sequelize, false, branchId);
    return allAlerts.filter((alert) =>
      alert.message.toLowerCase().includes("out of stock"),
    );
  }

  /**
   * Get warning alerts (low stock)
   */
  static async getWarningAlerts(
    sequelize: Sequelize,
    branchId?: number | null,
  ): Promise<AlertResponse[]> {
    const allAlerts = await this.getAlerts(sequelize, false, branchId);
    return allAlerts.filter(
      (alert) =>
        alert.message.toLowerCase().includes("low stock") &&
        !alert.message.toLowerCase().includes("out of stock"),
    );
  }
  /**
   * Get alert by ID
   */
  static async getAlertById(
    sequelize: Sequelize,
    alertId: number,
  ): Promise<Alert | null> {
    return await Alert.findByPk(alertId);
  }

  /**
   * Get product for alert
   */
  static async getProductForAlert(
    sequelize: Sequelize,
    productId: number,
  ): Promise<Product | null> {
    return await Product.findByPk(productId);
  }

  /**
   * Get branch for alert
   */
  static async getBranchForAlert(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<Branch | null> {
    return await Branch.findByPk(branchId);
  }

  /**
   * Check low stock for a specific branch and create alerts
   */
  static async checkLowStockForBranch(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<number> {
    const stocks = await Stock.findAll({
      where: { branch_id: branchId },
    });
    let alertsCreated = 0;

    for (const stock of stocks) {
      const product = await Product.findByPk(stock.product_id);
      const branch = await Branch.findByPk(stock.branch_id);

      if (!product || !branch) {
        continue;
      }

      const currentQty = Number(stock.quantity) || 0;
      const reorderLevel = Number(stock.reorder_level) || 0;

      // Check for out of stock
      if (currentQty <= 0) {
        const existingAlert = await Alert.findOne({
          where: {
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            resolved: false,
            message: { [Op.like]: "%out of stock%" },
          },
        });

        if (!existingAlert) {
          const message = `Out of stock: ${product.name} (SKU: ${product.sku}) is out of stock at ${branch.name}.`;
          await Alert.create({
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            message: message,
            resolved: false,
          });
          alertsCreated++;
        }
      }
      // Check for low stock
      else if (currentQty <= reorderLevel) {
        const existingAlert = await Alert.findOne({
          where: {
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            resolved: false,
            message: { [Op.like]: "%low stock%" },
          },
        });

        if (!existingAlert) {
          const message = `Low stock alert: ${product.name} (SKU: ${product.sku}) has only ${currentQty} units remaining at ${branch.name}. Reorder level is ${reorderLevel}.`;
          await Alert.create({
            branch_id: stock.branch_id,
            product_id: stock.product_id,
            message: message,
            resolved: false,
          });
          alertsCreated++;
        }
      }
    }

    if (alertsCreated > 0) {
      logger.info(
        `Created ${alertsCreated} low stock alerts for branch ${branchId}`,
      );
    }

    return alertsCreated;
  }

  /**
   * Auto-resolve alerts for a specific branch
   */
  static async autoResolveAlertsForBranch(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<number> {
    const unresolvedAlerts = await Alert.findAll({
      where: {
        branch_id: branchId,
        resolved: false,
      },
    });

    let resolvedCount = 0;

    for (const alert of unresolvedAlerts) {
      const stock = await Stock.findOne({
        where: {
          branch_id: alert.branch_id,
          product_id: alert.product_id,
        },
      });

      if (!stock) {
        continue;
      }

      const currentQty = Number(stock.quantity) || 0;
      const reorderLevel = Number(stock.reorder_level) || 0;

      if (
        alert.message.toLowerCase().includes("out of stock") &&
        currentQty > 0
      ) {
        alert.resolved = true;
        alert.resolved_at = new Date();
        await alert.save();
        resolvedCount++;
      } else if (
        alert.message.toLowerCase().includes("low stock") &&
        currentQty > reorderLevel
      ) {
        alert.resolved = true;
        alert.resolved_at = new Date();
        await alert.save();
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      logger.info(
        `Auto-resolved ${resolvedCount} alerts for branch ${branchId}`,
      );
    }

    return resolvedCount;
  }

  /**
   * Bulk resolve alerts for a branch
   */
  static async bulkResolveBranchAlerts(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<number> {
    const alerts = await Alert.findAll({
      where: {
        branch_id: branchId,
        resolved: false,
      },
    });

    let resolvedCount = 0;

    for (const alert of alerts) {
      alert.resolved = true;
      alert.resolved_at = new Date();
      await alert.save();
      resolvedCount++;
    }

    if (resolvedCount > 0) {
      logger.info(
        `Bulk resolved ${resolvedCount} alerts for branch ${branchId}`,
      );
    }

    return resolvedCount;
  }
}
