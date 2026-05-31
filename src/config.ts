import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

export class Settings {
  // Database Type Selection
  DATABASE_TYPE: string = process.env.DATABASE_TYPE || "sqlite";

  // SQLite Configuration
  DB_DIR: string = process.env.DB_DIR || process.cwd(); // Changed to current directory
  DB_FILENAME: string = process.env.DB_FILENAME || "sifa_inventory.db";

  // MySQL Database Configuration
  DB_HOST: string = process.env.DB_HOST || "localhost";
  DB_PORT: number = parseInt(process.env.DB_PORT || "3306");
  DB_USER: string = process.env.DB_USER || "root";
  DB_PASSWORD: string = process.env.DB_PASSWORD || "password";
  DB_NAME: string = process.env.DB_NAME || "inventory_db";

  // Connection Pool Settings (for MySQL)
  DB_POOL_SIZE: number = parseInt(process.env.DB_POOL_SIZE || "5");
  DB_MAX_OVERFLOW: number = parseInt(process.env.DB_MAX_OVERFLOW || "10");
  DB_POOL_TIMEOUT: number = parseInt(process.env.DB_POOL_TIMEOUT || "30");
  DB_POOL_RECYCLE: number = parseInt(process.env.DB_POOL_RECYCLE || "3600");
  DB_POOL_PRE_PING: boolean =
    (process.env.DB_POOL_PRE_PING || "true") === "true";

  // Security
  SECRET_KEY: string =
    process.env.SECRET_KEY ||
    "your-secret-key-change-this-in-production-minimum-32-chars";
  ALGORITHM: string = "HS256";
  ACCESS_TOKEN_EXPIRE_MINUTES: number = parseInt(
    process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "30",
  );

  // App
  APP_NAME: string = "Sefa Inventory Management System";
  APP_VERSION: string = "1.0.0";
  DEBUG: boolean = (process.env.DEBUG || "true") === "true";

  // Brevo Email Settings
  BREVO_API_KEY: string = process.env.BREVO_API_KEY || "";
  BREVO_SENDER_EMAIL: string =
    process.env.BREVO_SENDER_EMAIL || "minilik71@gmail.com";
  BREVO_SENDER_NAME: string =
    process.env.BREVO_SENDER_NAME || "SmartLink Inventory System";
  EMAIL_ENABLED: boolean = (process.env.EMAIL_ENABLED || "true") === "true";

  // Fallback SMTP Settings
  SMTP_HOST: string = process.env.SMTP_HOST || "";
  SMTP_PORT: number = parseInt(process.env.SMTP_PORT || "587");
  SMTP_USER: string = process.env.SMTP_USER || "";
  SMTP_PASSWORD: string = process.env.SMTP_PASSWORD || "";
  SMTP_FROM_EMAIL: string = process.env.SMTP_FROM_EMAIL || "";

  // Frontend URL
  FRONTEND_URL: string =
    process.env.FRONTEND_URL || "https://smartlink-inventory.up.railway.app";
  DASHBOARD_URL: string =
    process.env.DASHBOARD_URL || "https://smartlink-inventory.up.railway.app";

  // Environment
  ENVIRONMENT: string = process.env.ENVIRONMENT || "development";

  // Scheduler enabled
  ENABLE_SCHEDULER: boolean =
    (process.env.ENABLE_SCHEDULER || "true") === "true";

  // Construct DATABASE_URL dynamically
  get DATABASE_URL(): string {
    if (this.DATABASE_TYPE === "sqlite") {
      // Ensure directory exists
      if (!fs.existsSync(this.DB_DIR)) {
        fs.mkdirSync(this.DB_DIR, { recursive: true });
      }

      const dbPath = path.join(this.DB_DIR, this.DB_FILENAME);
      return `sqlite:///${dbPath}`;
    } else {
      // MySQL connection string
      return `mysql://${this.DB_USER}:${this.DB_PASSWORD}@${this.DB_HOST}:${this.DB_PORT}/${this.DB_NAME}`;
    }
  }

  // SQLite-specific connection arguments
  get SQLITE_CONNECT_ARGS(): any {
    if (this.DATABASE_TYPE === "sqlite") {
      return {
        connection: {
          filename: path.join(this.DB_DIR, this.DB_FILENAME),
        },
        useNullAsDefault: true,
      };
    }
    return {};
  }

  getDatabaseInfo(): any {
    if (this.DATABASE_TYPE === "sqlite") {
      const dbPath = path.join(this.DB_DIR, this.DB_FILENAME);
      return {
        type: "SQLite",
        path: dbPath,
        directory_exists: fs.existsSync(this.DB_DIR),
        file_exists: fs.existsSync(dbPath),
        directory_writable: this.isWritable(this.DB_DIR),
      };
    } else {
      return {
        type: "MySQL",
        host: this.DB_HOST,
        port: this.DB_PORT,
        database: this.DB_NAME,
        user: this.DB_USER,
      };
    }
  }

  private isWritable(directory: string): boolean {
    try {
      fs.accessSync(directory, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export const settings = new Settings();

// Print database info on startup
if (settings.DEBUG) {
  console.log(`📊 Database Type: ${settings.getDatabaseInfo().type}`);
  console.log(`📁 Database Info:`, settings.getDatabaseInfo());
}
