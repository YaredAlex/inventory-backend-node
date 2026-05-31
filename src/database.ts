import { Sequelize, Options } from "sequelize";
import { settings } from "./config.js";
import { initModels } from "./models/index.js";
import fs from "fs";
import path from "path";

class Database {
  public sequelize: Sequelize | null = null;
  private _ready: Promise<void>;
  private _resolveReady!: () => void;
  constructor() {
    this._ready = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
    this.initialize().then(() => this._resolveReady());
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  private async initialize() {
    const dbConfig = this.getDatabaseConfig();
    this.sequelize = new Sequelize(dbConfig);
    await this.sequelize.authenticate();
    // Initialize all models
    await this.importModels();
    // Initialize database (create tables)
    await this.initDB();
    if (settings.DATABASE_TYPE === "sqlite") {
      const dbInfo = settings.getDatabaseInfo();
      if (fs.existsSync(dbInfo.path)) {
        const stats = fs.statSync(dbInfo.path);
        console.log(
          `✅ SQLite database configured: ${dbInfo.path} (${stats.size} bytes)`,
        );
      }
    } else {
      console.log(
        `✅ MySQL database configured: ${settings.DB_HOST}:${settings.DB_PORT}/${settings.DB_NAME}`,
      );
    }
  }

  private getDatabaseConfig(): Options {
    if (settings.DATABASE_TYPE === "sqlite") {
      return {
        dialect: "sqlite",
        storage: path.join(settings.DB_DIR, settings.DB_FILENAME),
        logging: settings.DEBUG ? console.log : false,
        pool: { max: 1, min: 0, acquire: 30000, idle: 10000 },
      };
    } else {
      return {
        dialect: "mysql",
        host: settings.DB_HOST,
        port: settings.DB_PORT,
        username: settings.DB_USER,
        password: settings.DB_PASSWORD,
        database: settings.DB_NAME,
        logging: settings.DEBUG ? console.log : false,
        pool: {
          max: settings.DB_POOL_SIZE,
          min: 0,
          acquire: settings.DB_POOL_TIMEOUT * 1000,
          idle: 10000,
        },
      };
    }
  }

  async importModels() {
    if (!this.sequelize) {
      throw new Error("Sequelize not initialized");
    }

    // Initialize all models and setup associations
    initModels(this.sequelize);
    console.log("✅ All models initialized");
  }

  async initDB() {
    console.log("Creating database tables...");
    if (this.sequelize) {
      await this.sequelize.sync({ alter: settings.DEBUG });
      console.log("✅ Database tables created successfully!");

      if (settings.DATABASE_TYPE === "sqlite") {
        const dbInfo = settings.getDatabaseInfo();
        if (fs.existsSync(dbInfo.path)) {
          const size = fs.statSync(dbInfo.path).size;
          console.log(
            `✅ SQLite database file created: ${dbInfo.path} (${size} bytes)`,
          );
        }
      }
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.sequelize?.authenticate();
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  /**
   * Close the database connection
   * This should be called when shutting down the application
   */
  async close(): Promise<void> {
    if (this.sequelize) {
      try {
        // For SQLite, ensure all statements are finalized
        if (settings.DATABASE_TYPE === "sqlite") {
          const dbPath = path.join(settings.DB_DIR, settings.DB_FILENAME);
          console.log(`Closing SQLite database at: ${dbPath}`);
        }

        await this.sequelize.close();
        console.log("✅ Database connection closed successfully");
        this.sequelize = null;
      } catch (error) {
        console.error("❌ Error closing database connection:", error);
        throw error;
      }
    }
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.sequelize !== null;
  }

  /**
   * Force close the database connection (no graceful shutdown)
   */
  async forceClose(): Promise<void> {
    if (this.sequelize) {
      try {
        await this.sequelize.close();
        this.sequelize = null;
        console.log("✅ Database connection force closed");
      } catch (error) {
        console.error("❌ Error force closing database connection:", error);
      }
    }
  }
}

// Export singleton instance

export const database = new Database();
export const sequelize = database.sequelize;
export default database;
