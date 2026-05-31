import { Router, Request, Response } from "express";
import multer from "multer";
import { Op } from "sequelize";
import { database } from "../database.js";
import { SettingsService } from "../services/setting_service.js";
import { requireAdmin, getCurrentUser } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import { settings as appSettings } from "../config.js";
import logger from "../services/logger.js";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

interface AuthenticatedRequest extends Request {
  user?: any;
}

interface SettingsUpdateRequest {
  settings: Record<string, any>;
}

const router = Router();

// All setting routes require admin access (except public bank accounts)
router.use(requireAdmin);

// ==================== GENERAL SETTINGS ====================

// GET - Get general system settings
router.get(
  "/general",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await SettingsService.getCategorySettings(
      database.sequelize!,
      "general",
    );
    res.json(settings);
  }),
);

// PUT - Update general system settings
router.put(
  "/general",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { settings }: SettingsUpdateRequest = req.body;
    const currentUser = req.user!;

    await SettingsService.setMultipleSettings(
      database.sequelize!,
      "general",
      settings,
      currentUser.id,
    );

    res.json({
      message: "General settings updated successfully",
      success: true,
    });
  }),
);

// ==================== NOTIFICATION SETTINGS ====================

// GET - Get notification settings
router.get(
  "/notifications",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await SettingsService.getCategorySettings(
      database.sequelize!,
      "notification",
    );
    res.json(settings);
  }),
);

// PUT - Update notification settings
router.put(
  "/notifications",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { settings }: SettingsUpdateRequest = req.body;
    const currentUser = req.user!;

    await SettingsService.setMultipleSettings(
      database.sequelize!,
      "notification",
      settings,
      currentUser.id,
    );

    res.json({
      message: "Notification settings updated successfully",
      success: true,
    });
  }),
);

// ==================== BACKUP SETTINGS ====================

// GET - Get backup settings
router.get(
  "/backup",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await SettingsService.getCategorySettings(
      database.sequelize!,
      "backup",
    );
    res.json(settings);
  }),
);

// PUT - Update backup settings
router.put(
  "/backup",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { settings }: SettingsUpdateRequest = req.body;
    const currentUser = req.user!;

    await SettingsService.setMultipleSettings(
      database.sequelize!,
      "backup",
      settings,
      currentUser.id,
    );

    res.json({
      message: "Backup settings updated successfully",
      success: true,
    });
  }),
);

// ==================== BACKUP MANAGEMENT ====================

// POST - Create a manual database backup
router.post(
  "/backup/create",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const backup = await SettingsService.createBackup(
      database.sequelize!,
      currentUser.id,
    );
    res.json(backup);
  }),
);

// GET - Get recent backups list
router.get(
  "/backups",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const backups = await SettingsService.getBackups(
      database.sequelize!,
      limit,
    );
    res.json(backups);
  }),
);

// DELETE - Delete a backup file
router.delete(
  "/backups/:backupId",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const backupId = parseInt(req.params.backupId as string);
    const currentUser = req.user!;

    const success = await SettingsService.deleteBackup(
      database.sequelize!,
      backupId,
      currentUser.id,
    );
    if (!success) {
      throw new AppError("Backup not found", 404);
    }

    res.json({ message: "Backup deleted successfully", success: true });
  }),
);

// ==================== DATABASE DOWNLOAD (ZIP) ====================

// GET - Download the entire database as a ZIP file
router.get(
  "/database/download",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (appSettings.DATABASE_TYPE !== "sqlite") {
      throw new AppError("Download only supported for SQLite database", 501);
    }

    const dbPath = path.join(appSettings.DB_DIR, appSettings.DB_FILENAME);

    if (!fs.existsSync(dbPath)) {
      throw new AppError("Database file not found", 404);
    }

    // Create a new ZIP file
    const zip = new AdmZip();

    // Add the database file
    zip.addLocalFile(dbPath);

    // Add metadata file
    const metadata = {
      backup_date: new Date().toISOString(),
      database_type: appSettings.DATABASE_TYPE,
      database_file: appSettings.DB_FILENAME,
      app_version: appSettings.APP_VERSION,
      backup_by: req.user?.email,
      file_size_bytes: fs.statSync(dbPath).size,
    };

    zip.addFile(
      "backup_info.json",
      Buffer.from(JSON.stringify(metadata, null, 2)),
    );

    // Generate ZIP buffer
    const zipBuffer = zip.toBuffer();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `database_backup_${appSettings.APP_NAME}_${timestamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Length", zipBuffer.length);
    res.send(zipBuffer);
  }),
);
// ==================== DATABASE RESTORE ====================

// POST - Restore database from a ZIP file
router.post(
  "/database/restore/simple",
  upload.single("backup_file"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file;
    const currentUser = req.user!;

    if (!file) {
      throw new AppError("No file uploaded", 400);
    }

    if (!file.originalname.endsWith(".zip")) {
      throw new AppError("Only ZIP files are accepted", 400);
    }

    if (appSettings.DATABASE_TYPE !== "sqlite") {
      throw new AppError("Restore only supported for SQLite", 501);
    }

    try {
      const zip = new AdmZip(file.buffer);
      const zipEntries = zip.getEntries();

      // Find database file
      let dbFileEntry = null;
      let metadataEntry = null;

      for (const entry of zipEntries) {
        if (
          entry.entryName.endsWith(".db") ||
          entry.entryName === appSettings.DB_FILENAME
        ) {
          dbFileEntry = entry;
        }
        if (entry.entryName === "backup_info.json") {
          metadataEntry = entry;
        }
      }

      if (!dbFileEntry) {
        throw new AppError(
          "ZIP file does not contain a valid database file",
          400,
        );
      }

      const dbContent = dbFileEntry.getData();
      let metadata = {};

      if (metadataEntry) {
        const metadataContent = metadataEntry.getData().toString("utf8");
        metadata = JSON.parse(metadataContent);
      }

      const dbPath = path.join(appSettings.DB_DIR, appSettings.DB_FILENAME);

      // Ensure directory exists
      if (!fs.existsSync(appSettings.DB_DIR)) {
        fs.mkdirSync(appSettings.DB_DIR, { recursive: true });
      }

      // Create backup of current database
      if (fs.existsSync(dbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = `${dbPath}.pre_restore_${timestamp}`;
        fs.copyFileSync(dbPath, backupPath);
        logger.info(`Pre-restore backup saved: ${backupPath}`);
      }

      // Write new database
      fs.writeFileSync(dbPath, dbContent);
      fs.chmodSync(dbPath, 0o666);

      res.json({
        message: "Database restored successfully",
        success: true,
        filename: file.originalname,
        backup_info: metadata,
        restored_by: currentUser.email,
        restored_at: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Restore error: ${error.message}`);
      throw new AppError(`Failed to restore database: ${error.message}`, 500);
    }
  }),
);

// ==================== DATABASE INFO ====================

// GET - Get information about the current database
router.get(
  "/database/info",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (appSettings.DATABASE_TYPE === "sqlite") {
      const dbPath = path.join(appSettings.DB_DIR, appSettings.DB_FILENAME);

      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const sizeMb = stats.size / (1024 * 1024);

        // Get table counts
        const tables = await database.sequelize!.query(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `,
          { type: "SELECT" },
        );

        const tableInfo = [];
        for (const table of tables as any[]) {
          const countResult = await database.sequelize!.query(
            `SELECT COUNT(*) as count FROM ${table.name}`,
            { type: "SELECT" },
          );
          tableInfo.push({
            name: table.name,
            rows: (countResult[0] as any).count,
          });
        }

        res.json({
          database_type: "SQLite",
          path: dbPath,
          exists: true,
          size_mb: parseFloat(sizeMb.toFixed(2)),
          last_modified: new Date(stats.mtime).toISOString(),
          tables: tableInfo,
        });
      } else {
        res.json({
          database_type: "SQLite",
          path: dbPath,
          exists: false,
          size_mb: 0,
        });
      }
    } else {
      res.json({
        database_type: "MySQL",
        info: "Use /api/settings/system/info for MySQL details",
      });
    }
  }),
);

// ==================== CACHE MANAGEMENT ====================

// POST - Clear application cache
router.post(
  "/cache/clear",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await SettingsService.clearCache();
    res.json(result);
  }),
);

// ==================== SYSTEM INFORMATION ====================

// GET - Get system information and statistics
router.get(
  "/system/info",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const info = await SettingsService.getSystemInfo(database.sequelize!);
    res.json(info);
  }),
);

// ==================== DATA MANAGEMENT ====================

// POST - Reset all system data (DANGER: This will delete all transactional data)
router.post(
  "/system/reset",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const result = await SettingsService.resetSystemData(
      database.sequelize!,
      currentUser.id,
    );
    res.json(result);
  }),
);

// POST - Export all system data as JSON
router.post(
  "/system/export",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await SettingsService.exportAllData(database.sequelize!);
    res.json(data);
  }),
);

// ==================== PUBLIC BANK ACCOUNTS ENDPOINT ====================

// GET - Get bank accounts for POS transactions (accessible by all authenticated users)
router.get(
  "/bank-accounts/public",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    console.log("=== FETCHING BANK ACCOUNTS ===");

    const settings = await SettingsService.getCategorySettings(
      database.sequelize!,
      "general",
    );
    console.log(`Settings retrieved: ${Object.keys(settings || {})}`);

    let bankAccounts: any[] = [];

    if (settings.bank_accounts) {
      console.log(
        `Found bank_accounts in settings: ${typeof settings.bank_accounts}`,
      );

      if (Array.isArray(settings.bank_accounts)) {
        bankAccounts = settings.bank_accounts;
        console.log(`Bank accounts as list: ${bankAccounts.length} accounts`);
      } else if (typeof settings.bank_accounts === "string") {
        try {
          bankAccounts = JSON.parse(settings.bank_accounts);
          console.log(
            `Bank accounts parsed from string: ${bankAccounts.length} accounts`,
          );
        } catch (error) {
          console.log(`Failed to parse bank_accounts JSON: ${error}`);
          bankAccounts = [];
        }
      }
    } else {
      console.log("No bank_accounts found in settings");
    }

    // Return only active bank accounts
    const activeAccounts = bankAccounts.filter(
      (acc) => acc.is_active !== false,
    );
    console.log(`Returning ${activeAccounts.length} active bank accounts`);

    res.json(activeAccounts);
  }),
);

export default router;
