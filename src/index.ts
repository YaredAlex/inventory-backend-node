import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cron from "node-cron";
import { database } from "./database.js";
import { settings } from "./config.js";
import { SettingsService } from "./services/setting_service.js";
import { EmailScheduler } from "./services/email_scheduler.js";
import { seedUsers } from "./seeders/user_seeder.js";
import { getCurrentUser } from "./utils/dependencies.js";
import { User, UserRole } from "./models/user.js";
import logger from "./services/logger.js";
import { errorHandler, notFound } from "./middleware/error_handle.js";
// Import routers
import authRouter from "./routes/auth.js";
import branchesRouter from "./routes/branches.js";
import dashboardRouter from "./routes/dashboard.js";
import productsRouter from "./routes/product.js";
import usersRouter from "./routes/user.js";
import loanRouter from "./routes/loan.js";
import reportRouter from "./routes/report.js";
import saleRouter from "./routes/sales.js";
import stockRouter from "./routes/stock.js";
import purchaseRouter from "./routes/purchase.js";
import settingsRouter from "./routes/setting.js";
import alertRouter from "./routes/alert.js";
import tempItemRouter from "./routes/tmpitems.js";
import bulkProductRouter from "./routes/bulk_product.js";
import bulkPurchaseRouter from "./routes/bulk_purchase.js";
import vatRouter from "./routes/vat.js";
import walletRouter from "./routes/wallet.js";
const app: Express = express();
const PORT = process.env.PORT || 8080;

// ==================== MIDDLEWARE ====================
// Add this after creating the app instance
app.set("sequelize", database.sequelize);
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://sefa-inventory.com",
      "https://inventory.sefa-inventory.com",
      "https://smartlink.sefa-inventory.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "Expires",
    ],
    exposedHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400, // Cache preflight request for 24 hours (in seconds)
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// ==================== SCHEDULER ====================
let lowStockJob: cron.ScheduledTask | null = null;
let dailyReportJob: cron.ScheduledTask | null = null;

function runLowStockCheck(): void {
  logger.info("Running low stock check...");
  EmailScheduler.checkAndSendLowStockAlerts(database.sequelize!).catch(
    (error) => logger.error(`Error in low stock check: ${error}`),
  );
}

function runDailyReport(): void {
  logger.info("Running daily report...");
  EmailScheduler.sendDailyReport(database.sequelize!).catch((error) =>
    logger.error(`Error in daily report: ${error}`),
  );
}

function startScheduler(): void {
  if (process.env.ENABLE_SCHEDULER?.toLowerCase() !== "false") {
    // Run every hour
    lowStockJob = cron.schedule("0 * * * *", runLowStockCheck);
    logger.info("✅ Low stock check scheduler started (every hour)");

    // Run at 8:00 AM daily
    dailyReportJob = cron.schedule("0 8 * * *", runDailyReport);
    logger.info("✅ Daily report scheduler started (8:00 AM)");
  } else {
    logger.info("Email scheduler disabled");
  }
}

function stopScheduler(): void {
  if (lowStockJob) lowStockJob.stop();
  if (dailyReportJob) dailyReportJob.stop();
  logger.info("Scheduler stopped");
}

// ==================== TEST EMAIL ENDPOINT ====================
app.post("/api/test/email", async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req, database.sequelize!);

    if (currentUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ detail: "Admin access required" });
    }

    const { EmailService } = await import("./services/email_service.js");

    const result = await EmailService.sendEmail({
      toEmails: [currentUser.email],
      subject: "Test Email from Inventory System",
      templateName: "daily_report.html",
      context: {
        user_name: currentUser.name,
        date: new Date().toISOString().split("T")[0],
        total_sales: 0,
        total_revenue: 0,
        total_refunds: 0,
        net_revenue: 0,
        top_products: [],
        low_stock_items: [],
      },
    });

    if (result) {
      res.json({ message: "Test email sent successfully" });
    } else {
      res.status(500).json({ detail: "Failed to send email" });
    }
  } catch (error) {
    logger.error(`Test email error: ${error}`);
    res.status(500).json({ detail: "Failed to send email" });
  }
});

// ==================== ROOT ENDPOINTS ====================
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: `Welcome to ${settings.APP_NAME}`,
    version: settings.APP_VERSION,
    database: settings.DATABASE_TYPE === "sqlite" ? "SQLite" : "MySQL",
    docs: "/api-docs",
  });
});

app.get("/health", async (req: Request, res: Response) => {
  const dbHealthy = await database.checkHealth();

  res.json({
    status: dbHealthy ? "healthy" : "unhealthy",
    database: settings.DATABASE_TYPE === "sqlite" ? "SQLite" : "MySQL",
    database_status: dbHealthy ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ==================== DATABASE INFO ENDPOINT ====================
app.get("/api/db-info", async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req, database.sequelize!);

    if (currentUser.role !== UserRole.ADMIN) {
      return res.status(403).json({ detail: "Admin access required" });
    }

    if (settings.DATABASE_TYPE === "sqlite") {
      const dbInfo = settings.getDatabaseInfo();
      const fs = await import("fs");

      if (fs.existsSync(dbInfo.path)) {
        const dbSize = fs.statSync(dbInfo.path).size;
        const sqlite3 = await import("sqlite3");
        const db = new sqlite3.Database(dbInfo.path);

        const tables: { [key: string]: number } = {};
        await new Promise<void>((resolve, reject) => {
          db.all(
            "SELECT name FROM sqlite_master WHERE type='table';",
            (err, rows: any[]) => {
              if (err) reject(err);
              let pending = rows.length;
              if (pending === 0) resolve();

              rows.forEach((row: any) => {
                db.get(
                  `SELECT COUNT(*) as count FROM ${row.name}`,
                  (err, result: any) => {
                    if (err) reject(err);
                    tables[row.name] = result.count;
                    pending--;
                    if (pending === 0) resolve();
                  },
                );
              });
            },
          );
        });

        db.close();

        res.json({
          database_type: "SQLite",
          database_path: dbInfo.path,
          database_size_mb: (dbSize / (1024 * 1024)).toFixed(2),
          tables,
        });
      } else {
        res.json({
          database_type: "SQLite",
          database_path: dbInfo.path,
          error: "Database file not found",
        });
      }
    } else {
      res.json({
        database_type: "MySQL",
        host: settings.DB_HOST,
        database: settings.DB_NAME,
      });
    }
  } catch (error) {
    logger.error(`DB info error: ${error}`);
    res.status(500).json({ detail: "Failed to get database info" });
  }
});
// ==================== ROUTES ====================
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/products/bulk", bulkProductRouter);
app.use("/api/products", productsRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/users", usersRouter);
app.use("/api/loans", loanRouter);
app.use("/api/reports", reportRouter);
// app.use("/api/purchases/bulk", bulkPurchaseRouter);
app.use("/api/purchases", purchaseRouter);
app.use("/api/sales", saleRouter);
app.use("/api/stock", stockRouter);
app.use("/api/alerts", alertRouter);
app.use("/api/temp-items", tempItemRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/vat", vatRouter);
app.use("/api/wallet", walletRouter);
app.use(notFound);

// Global error handler - must be last
app.use(errorHandler);
// ==================== ERROR HANDLING ====================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.stack}`);
  res.status(500).json({ detail: "Internal server error" });
});

// ==================== STARTUP FUNCTION ====================
async function startup(): Promise<void> {
  try {
    // Ensure database is initialized
    await database.ready;
    await database.initDB();

    // Initialize default settings
    const db = database.sequelize!;
    await SettingsService.initializeDefaultSettings(db);
    logger.info("✅ Default settings initialized");

    // Seed users
    await seedUsers(db);
    logger.info("✅ Users seeded successfully");

    // Initial low stock check
    await EmailScheduler.checkAndSendLowStockAlerts(db);
    logger.info("✅ Initial low stock check completed");

    // Start scheduler
    startScheduler();

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${settings.ENVIRONMENT}`);
      logger.info(`🗄️  Database: ${settings.getDatabaseInfo().type}`);
    });
  } catch (error) {
    logger.error(`Failed to start application: ${error}`);
    process.exit(1);
  }
}

// ==================== SHUTDOWN HANDLER ====================
async function shutdown(): Promise<void> {
  logger.info("Shutting down application...");
  stopScheduler();
  await database.close();
  logger.info("Database connections closed");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the application
startup();

export default app;
