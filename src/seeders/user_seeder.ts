import { Sequelize } from "sequelize";
import { User, UserRole } from "../models/user.js";
import { Branch } from "../models/branch.js";
import { AuthService } from "../services/auth_service.js";
import logger from "../services/logger.js";

export async function seedUsers(sequelize: Sequelize): Promise<void> {
  try {
    // Check if users already exist
    const existingUsersCount = await User.count();
    if (existingUsersCount > 0) {
      logger.info(
        `Users already exist (${existingUsersCount} users). Skipping seeding.`,
      );
      return;
    }

    // Get branches
    const branches = await Branch.findAll();
    logger.info(`Found ${branches.length} branches`);

    const usersToCreate: User[] = [];

    // Create admin user
    try {
      const adminPassword = "admin123";
      const adminPasswordHash =
        await AuthService.getPasswordHash(adminPassword);

      const adminUser = User.build({
        name: "System Administrator",
        email: "admin@example.com",
        password_hash: adminPasswordHash,
        role: UserRole.ADMIN,
        branch_id: null,
        active: true,
      });
      usersToCreate.push(adminUser);
      logger.info("✅ Created admin user");
    } catch (error) {
      logger.error(`❌ Failed to create admin user: ${error}`);
      return;
    }

    // Create salesman user
    try {
      const salesmanPassword = "sales123";
      const salesmanPasswordHash =
        await AuthService.getPasswordHash(salesmanPassword);

      const salesman = User.build({
        name: "Sales Representative",
        email: "sales@example.com",
        password_hash: salesmanPasswordHash,
        role: UserRole.SALESMAN,
        branch_id: branches.length > 0 ? branches[0]!.id : null,
        active: true,
      });
      usersToCreate.push(salesman);
      logger.info("✅ Created salesman user");
    } catch (error) {
      logger.error(`❌ Failed to create salesman: ${error}`);
    }

    // Add all users to database
    try {
      await User.bulkCreate(usersToCreate.map((user) => user.toJSON()));

      logger.info("=".repeat(60));
      logger.info(`✅ Successfully created ${usersToCreate.length} users`);
      logger.info("=".repeat(60));
      logger.info("📋 LOGIN CREDENTIALS:");
      logger.info("-".repeat(40));

      for (const user of usersToCreate) {
        if (user.role === UserRole.ADMIN) {
          logger.info(`👑 ADMIN:`);
          logger.info(`   Email: ${user.email}`);
          logger.info(`   Password: admin123`);
          logger.info(`   Role: ${user.role}`);
        } else if (user.role === UserRole.SALESMAN) {
          logger.info(`👤 SALESMAN:`);
          logger.info(`   Email: ${user.email}`);
          logger.info(`   Password: sales123`);
          logger.info(`   Role: ${user.role}`);
        }
      }
      logger.info("=".repeat(60));
    } catch (error) {
      logger.error(`❌ Failed to commit users: ${error}`);
    }
  } catch (error) {
    logger.error(`Failed to seed users: ${error}`);
  }
}
