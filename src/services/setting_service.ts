import { Sequelize, Op } from "sequelize";
import { SystemSetting } from "../models/system_setting.js";
import { SystemLog, LogType } from "../models/system_log.js";
import { BackupRecord } from "../models/backup_record.js";
import { User } from "../models/user.js";
import { Product } from "../models/product.js";
import { Branch } from "../models/branch.js";
import { Sale } from "../models/sale.js";
import { Loan } from "../models/loan.js";
import { Purchase } from "../models/purchase.js";
import { PurchaseItem } from "../models/purchase_item.js";
import { SaleItem } from "../models/sale_item.js";
import { Stock } from "../models/stock.js";
import { StockMovement } from "../models/stock_movement.js";
import { Alert } from "../models/alert.js";
import fs from "fs";
import path from "path";
import logger from "./logger.js";
import { LoanStatus } from "../schemas/loan.js";

export class SettingsService {
  private static getValue(setting: SystemSetting | null): any {
    if (setting && setting.value) {
      try {
        return JSON.parse(setting.value);
      } catch {
        return setting.value;
      }
    }
    return null;
  }

  private static setValue(value: any): string {
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  static async getSetting(
    sequelize: Sequelize,
    category: string,
    key: string,
  ): Promise<any> {
    const setting = await SystemSetting.findOne({
      where: { category, key },
    });
    return this.getValue(setting);
  }

  static async getCategorySettings(
    sequelize: Sequelize,
    category: string,
  ): Promise<Record<string, any>> {
    const settings = await SystemSetting.findAll({
      where: { category },
    });
    const result: Record<string, any> = {};
    settings.forEach((setting) => {
      result[setting.key] = this.getValue(setting);
    });
    return result;
  }

  static async setSetting(
    sequelize: Sequelize,
    category: string,
    key: string,
    value: any,
    userId?: number,
  ): Promise<any> {
    let setting = await SystemSetting.findOne({
      where: { category, key },
    });

    const oldValue = setting ? this.getValue(setting) : null;

    if (setting) {
      setting.value = this.setValue(value);
      await setting.save();
    } else {
      setting = await SystemSetting.create({
        category,
        key,
        value: this.setValue(value),
      });
    }

    if (userId) {
      await SystemLog.create({
        log_type: LogType.SETTINGS,
        message: `Setting changed: ${category}.${key}`,
        details: `Old: ${JSON.stringify(oldValue)}, New: ${JSON.stringify(value)}`,
        user_id: userId,
      });
    }

    return this.getValue(setting);
  }

  static async setMultipleSettings(
    sequelize: Sequelize,
    category: string,
    settingsDict: Record<string, any>,
    userId?: number,
  ): Promise<void> {
    for (const [key, value] of Object.entries(settingsDict)) {
      await this.setSetting(sequelize, category, key, value, userId);
    }
  }

  static async getAllSettings(
    sequelize: Sequelize,
  ): Promise<Record<string, any>> {
    const settings = await SystemSetting.findAll();
    const result: Record<string, any> = {};
    settings.forEach((setting) => {
      if (!result[setting.category]) {
        result[setting.category] = {};
      }
      result[setting.category][setting.key] = this.getValue(setting);
    });
    return result;
  }

  static async initializeDefaultSettings(sequelize: Sequelize): Promise<void> {
    const defaults = {
      general: {
        system_name: "Inventory System",
        timezone: "Africa/Addis_Ababa",
        date_format: "YYYY-MM-DD",
        currency: "ETB",
        language: "en",
        items_per_page: 20,
        default_tax_rate: 15,
      },
      notification: {
        low_stock_email: true,
        daily_report_email: true,
        sms_alerts: false,
        loan_overdue_alerts: true,
        email_recipients: ["admin@example.com"],
        sms_recipients: [],
      },
      backup: {
        auto_backup: true,
        frequency: "daily",
        backup_time: "23:00",
        location: "local",
        retention_days: 30,
      },
    };

    for (const [category, categorySettings] of Object.entries(defaults)) {
      for (const [key, value] of Object.entries(categorySettings)) {
        const existing = await SystemSetting.findOne({
          where: { category, key },
        });
        if (!existing) {
          await SystemSetting.create({
            category,
            key,
            value: this.setValue(value),
          });
        }
      }
    }
  }

  static async getSystemInfo(
    sequelize: Sequelize,
  ): Promise<Record<string, any>> {
    const totalUsers = await User.count();
    const totalProducts = await Product.count();
    const totalBranches = await Branch.count();

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const recentSales = await Sale.count({
      where: { created_at: { [Op.gte]: lastWeek } },
    });

    const lastBackup = await BackupRecord.findOne({
      order: [["created_at", "DESC"]],
    });

    const activeLoans = await Loan.count({
      where: { status: [LoanStatus.ACTIVE] },
    });

    const cacheSize =
      (await this.getSetting(sequelize, "system", "cache_size")) || 24.5;
    const lastCacheClear = await this.getSetting(
      sequelize,
      "system",
      "last_cache_clear",
    );

    return {
      version: "2.0.0",
      build_date: "2024-03-15",
      database: "PostgreSQL/SQLite",
      server_status: "online",
      total_users: totalUsers,
      total_products: totalProducts,
      total_branches: totalBranches,
      recent_sales: recentSales,
      uptime_days: 45,
      active_loans: activeLoans,
      last_backup: lastBackup?.created_at.toISOString() || null,
      cache_size_mb: Number(cacheSize),
      last_cache_clear: lastCacheClear,
    };
  }

  static async clearCache(): Promise<{
    cleared: boolean;
    size_freed_mb: number;
  }> {
    return { cleared: true, size_freed_mb: 24.5 };
  }

  static async createBackup(
    sequelize: Sequelize,
    userId?: number,
  ): Promise<Record<string, any>> {
    try {
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFilename = `backup_${timestamp}.sql`;
      const backupPath = path.join(backupDir, backupFilename);

      // Simple backup content (you may want to implement full DB dump)
      fs.writeFileSync(
        backupPath,
        `-- Backup created at ${new Date().toISOString()}\n-- Database backup content\n`,
      );

      const fileSize = fs.statSync(backupPath).size / (1024 * 1024);

      const backup = await BackupRecord.create({
        name: backupFilename,
        file_path: backupPath,
        size_mb: fileSize,
        created_by: userId || null,
      });

      if (userId) {
        await SystemLog.create({
          log_type: LogType.BACKUP,
          message: `Backup created: ${backupFilename}`,
          details: `Size: ${fileSize.toFixed(2)} MB`,
          user_id: userId,
        });
      }

      return {
        id: backup.id,
        name: backup.name,
        size_mb: fileSize,
        created_at: backup.created_at.toISOString(),
      };
    } catch (error) {
      logger.error(`Backup creation failed: ${error}`);
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  static async getBackups(
    sequelize: Sequelize,
    limit: number = 10,
  ): Promise<any[]> {
    const backups = await BackupRecord.findAll({
      limit,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["name"],
        },
      ],
    });

    return backups.map((backup) => ({
      id: backup.id,
      name: backup.name,
      size_mb: Number(backup.size_mb),
      created_at: backup.created_at.toISOString(),
      created_by: (backup as any).creator?.name || "System",
    }));
  }

  static async deleteBackup(
    sequelize: Sequelize,
    backupId: number,
    userId?: number,
  ): Promise<boolean> {
    const backup = await BackupRecord.findByPk(backupId);
    if (!backup) return false;

    if (fs.existsSync(backup.file_path)) {
      fs.unlinkSync(backup.file_path);
    }

    await backup.destroy();

    if (userId) {
      await SystemLog.create({
        log_type: LogType.BACKUP,
        message: `Backup deleted: ${backup.name}`,
        user_id: userId,
      });
    }

    return true;
  }

  static async exportAllData(
    sequelize: Sequelize,
  ): Promise<Record<string, any>> {
    const products = await Product.findAll();
    const branches = await Branch.findAll();
    const users = await User.findAll();

    return {
      export_date: new Date().toISOString(),
      export_version: "2.0.0",
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        color: p.color,
        size: p.size,
        price: Number(p.price),
        cost: Number(p.cost),
        active: p.active,
      })),
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        branch_id: u.branch_id,
        active: u.active,
      })),
    };
  }

  static async resetSystemData(
    sequelize: Sequelize,
    userId?: number,
  ): Promise<{ message: string }> {
    const transaction = await sequelize.transaction();
    try {
      await Loan.destroy({ where: {}, transaction });
      await SaleItem.destroy({ where: {}, transaction });
      await Sale.destroy({ where: {}, transaction });
      await PurchaseItem.destroy({ where: {}, transaction });
      await Purchase.destroy({ where: {}, transaction });
      await StockMovement.destroy({ where: {}, transaction });
      await Stock.destroy({ where: {}, transaction });
      await Alert.destroy({ where: {}, transaction });

      await transaction.commit();

      if (userId) {
        await SystemLog.create({
          log_type: LogType.WARNING,
          message: "System data reset",
          details: "All transactional data has been cleared",
          user_id: userId,
        });
      }

      return { message: "System data reset successfully" };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Failed to reset data: ${error}`);
    }
  }
}
