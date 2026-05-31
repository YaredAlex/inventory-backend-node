import { Sequelize, Op } from "sequelize";
import { Branch, BranchAttributes } from "../models/branch.js";
import { User } from "../models/user.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { Sale } from "../models/sale.js";
import { Purchase } from "../models/purchase.js";
import { PurchaseOrder } from "../models/purchase_order.js";
import { StockMovement } from "../models/stock_movement.js";
import { Alert } from "../models/alert.js";
import { Loan } from "../models/loan.js";
import { BankAccount } from "../models/bank_account.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

// Interface for branch creation data
export interface CreateBranchData {
  name: string;
  address?: string | null;
  phone?: string | null;
}

// Interface for branch update data (all fields optional)
export interface UpdateBranchData {
  name?: string;
  address?: string | null;
  phone?: string | null;
}

// Interface for branch with additional info
export interface BranchWithStats extends BranchAttributes {
  user_count?: number;
  stock_count?: number;
  sale_count?: number;
  total_revenue?: number;
  active_alerts?: number;
  active_loans?: number;
}

// Interface for branch summary
export interface BranchSummary {
  id: number;
  name: string;
  staff_count: number;
  stock_quantity: number;
}

export class BranchService {
  /**
   * Create a new branch
   */
  static async createBranch(
    sequelize: Sequelize,
    branchData: CreateBranchData,
  ): Promise<Branch> {
    // Validate required fields
    if (!branchData.name || branchData.name.trim().length === 0) {
      throw new AppError("Branch name is required", 400);
    }

    // Check if branch with same name already exists
    const existingBranch = await Branch.findOne({
      where: { name: branchData.name },
    });

    if (existingBranch) {
      throw new AppError(
        `Branch with name "${branchData.name}" already exists`,
        400,
      );
    }

    // Create the branch
    const branch = await Branch.create({
      name: branchData.name,
      address: branchData.address || null,
      phone: branchData.phone || null,
    });

    logger.info(`Branch created: ${branch.name} (ID: ${branch.id})`);
    return branch;
  }

  /**
   * Get all branches
   */
  static async getBranches(
    sequelize: Sequelize,
    options?: {
      includeStats?: boolean;
      active?: boolean;
      search?: string;
    },
  ): Promise<Branch[] | BranchWithStats[]> {
    const { includeStats = false, active, search } = options || {};

    // Build where clause
    const where: any = {};
    if (active !== undefined) {
      // Since Branch doesn't have an active field, we filter based on existing users/stocks
      // This is a placeholder - you may want to add an 'active' field to Branch model
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const branches = await Branch.findAll({
      where,
      order: [["name", "ASC"]],
    });

    // If stats are requested, fetch additional information
    if (includeStats) {
      const branchesWithStats: BranchWithStats[] = [];

      for (const branch of branches) {
        const userCount = await User.count({
          where: { branch_id: branch.id },
        });

        const stockCount = await Stock.count({
          where: { branch_id: branch.id },
        });

        const saleCount = await Sale.count({
          where: { branch_id: branch.id },
        });

        const totalRevenue = await Sale.sum("total_amount", {
          where: { branch_id: branch.id },
        });

        const activeAlerts = await Alert.count({
          where: {
            branch_id: branch.id,
            resolved: false,
          },
        });

        const activeLoans = await Loan.count({
          where: {
            branch_id: branch.id,
            status: "active",
          },
        });

        branchesWithStats.push({
          ...branch.toJSON(),
          user_count: userCount,
          stock_count: stockCount,
          sale_count: saleCount,
          total_revenue: Number(totalRevenue || 0),
          active_alerts: activeAlerts,
          active_loans: activeLoans,
        });
      }

      return branchesWithStats;
    }

    return branches;
  }

  /**
   * Get a single branch by ID
   */
  static async getBranch(
    sequelize: Sequelize,
    branchId: number,
    includeStats: boolean = false,
  ): Promise<Branch | BranchWithStats | null> {
    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return null;
    }

    // If stats are requested, fetch additional information
    if (includeStats) {
      const userCount = await User.count({
        where: { branch_id: branch.id },
      });

      const stockCount = await Stock.count({
        where: { branch_id: branch.id },
      });

      const saleCount = await Sale.count({
        where: { branch_id: branch.id },
      });

      const totalRevenue = await Sale.sum("total_amount", {
        where: { branch_id: branch.id },
      });

      const activeAlerts = await Alert.count({
        where: {
          branch_id: branch.id,
          resolved: false,
        },
      });

      const activeLoans = await Loan.count({
        where: {
          branch_id: branch.id,
          status: "active",
        },
      });

      return {
        ...branch.toJSON(),
        user_count: userCount,
        stock_count: stockCount,
        sale_count: saleCount,
        total_revenue: Number(totalRevenue || 0),
        active_alerts: activeAlerts,
        active_loans: activeLoans,
      };
    }

    return branch;
  }

  /**
   * Get branch by name
   */
  static async getBranchByName(
    sequelize: Sequelize,
    name: string,
  ): Promise<Branch | null> {
    return await Branch.findOne({
      where: { name },
    });
  }

  /**
   * Update a branch
   */
  static async updateBranch(
    sequelize: Sequelize,
    branchId: number,
    branchData: UpdateBranchData,
  ): Promise<Branch | null> {
    const branch = await this.getBranch(sequelize, branchId);

    if (!branch) {
      return null;
    }

    // If name is being updated, check for duplicates
    if (branchData.name && branchData.name !== branch.name) {
      const existingBranch = await Branch.findOne({
        where: {
          name: branchData.name,
          id: { [Op.ne]: branchId },
        },
      });

      if (existingBranch) {
        throw new AppError(
          `Branch with name "${branchData.name}" already exists`,
          400,
        );
      }
    }

    // Update only the fields that are provided
    const updateFields: any = {};
    if (branchData.name !== undefined) updateFields.name = branchData.name;
    if (branchData.address !== undefined)
      updateFields.address = branchData.address;
    if (branchData.phone !== undefined) updateFields.phone = branchData.phone;

    await Branch.update(updateFields, {
      where: { id: branchId },
    });

    const updatedBranch = await Branch.findByPk(branchId);
    logger.info(`Branch updated: ID ${branchId}`);

    return updatedBranch;
  }

  /**
   * Delete a branch (checks for dependencies first)
   */
  static async deleteBranch(
    sequelize: Sequelize,
    branchId: number,
    force: boolean = false,
  ): Promise<boolean> {
    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return false;
    }

    // Check for dependencies
    if (!force) {
      const userCount = await User.count({
        where: { branch_id: branchId },
      });

      const stockCount = await Stock.count({
        where: { branch_id: branchId },
      });

      const saleCount = await Sale.count({
        where: { branch_id: branchId },
      });

      const purchaseCount = await Purchase.count({
        where: { branch_id: branchId },
      });

      const loanCount = await Loan.count({
        where: { branch_id: branchId },
      });

      if (
        userCount > 0 ||
        stockCount > 0 ||
        saleCount > 0 ||
        purchaseCount > 0 ||
        loanCount > 0
      ) {
        throw new AppError(
          `Cannot delete branch with existing data. ` +
            `Users: ${userCount}, Stock: ${stockCount}, Sales: ${saleCount}, ` +
            `Purchases: ${purchaseCount}, Loans: ${loanCount}`,
          400,
        );
      }
    }

    // Force delete - remove all related records
    if (force) {
      const transaction = await sequelize.transaction();

      try {
        // Delete related records in order
        await User.destroy({ where: { branch_id: branchId }, transaction });
        await Stock.destroy({ where: { branch_id: branchId }, transaction });
        await Sale.destroy({ where: { branch_id: branchId }, transaction });
        await Purchase.destroy({ where: { branch_id: branchId }, transaction });
        await PurchaseOrder.destroy({
          where: { branch_id: branchId },
          transaction,
        });
        await StockMovement.destroy({
          where: { branch_id: branchId },
          transaction,
        });
        await Alert.destroy({ where: { branch_id: branchId }, transaction });
        await Loan.destroy({ where: { branch_id: branchId }, transaction });
        await BankAccount.destroy({
          where: { branch_id: branchId },
          transaction,
        });

        // Finally delete the branch
        await branch.destroy({ transaction });

        await transaction.commit();
        logger.info(
          `Branch force deleted: ID ${branchId} with all related records`,
        );
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
      // Normal delete (should only work if no dependencies)
      await branch.destroy();
      logger.info(`Branch deleted: ID ${branchId}`);
    }

    return true;
  }

  /**
   * Get branch statistics
   */
  static async getBranchStatistics(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<{
    branch: Branch | null;
    stats: {
      total_users: number;
      total_stock_items: number;
      total_sales: number;
      total_revenue: number;
      total_purchases: number;
      total_stock_movements: number;
      active_alerts: number;
      active_loans: number;
      total_loan_amount: number;
      total_bank_accounts: number;
    };
  }> {
    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return { branch: null, stats: {} as any };
    }

    const [
      userCount,
      stockCount,
      saleCount,
      totalRevenue,
      purchaseCount,
      stockMovementCount,
      activeAlerts,
      activeLoans,
      totalLoanAmount,
      bankAccountCount,
    ] = await Promise.all([
      User.count({ where: { branch_id: branchId } }),
      Stock.count({ where: { branch_id: branchId } }),
      Sale.count({ where: { branch_id: branchId } }),
      Sale.sum("total_amount", { where: { branch_id: branchId } }),
      Purchase.count({ where: { branch_id: branchId } }),
      StockMovement.count({ where: { branch_id: branchId } }),
      Alert.count({ where: { branch_id: branchId, resolved: false } }),
      Loan.count({ where: { branch_id: branchId, status: "active" } }),
      Loan.sum("remaining_amount", {
        where: { branch_id: branchId, status: "active" },
      }),
      BankAccount.count({ where: { branch_id: branchId, is_active: true } }),
    ]);

    return {
      branch,
      stats: {
        total_users: userCount,
        total_stock_items: stockCount,
        total_sales: saleCount,
        total_revenue: Number(totalRevenue || 0),
        total_purchases: purchaseCount,
        total_stock_movements: stockMovementCount,
        active_alerts: activeAlerts,
        active_loans: activeLoans,
        total_loan_amount: Number(totalLoanAmount || 0),
        total_bank_accounts: bankAccountCount,
      },
    };
  }

  /**
   * Get branches with low stock summary
   */
  static async getBranchesWithLowStock(
    sequelize: Sequelize,
    threshold: number = 10,
  ): Promise<
    Array<{
      branch: Branch;
      low_stock_count: number;
      low_stock_products: Array<{
        product_name: string;
        current_stock: number;
        reorder_level: number;
      }>;
    }>
  > {
    const branches = await Branch.findAll();
    const result = [];

    for (const branch of branches) {
      const lowStockItems = await Stock.findAll({
        where: {
          branch_id: branch.id,
          quantity: { [Op.lte]: threshold },
        },
        include: [{ model: Product, as: "product", required: true }],
      });

      if (lowStockItems.length > 0) {
        result.push({
          branch,
          low_stock_count: lowStockItems.length,
          low_stock_products: lowStockItems.map((item) => ({
            product_name: (item as any).product?.name || "Unknown",
            current_stock: Number(item.quantity),
            reorder_level: Number(item.reorder_level),
          })),
        });
      }
    }

    return result;
  }

  /**
   * Get branch summary for dashboard
   */
  static async getBranchSummary(sequelize: Sequelize): Promise<{
    total_branches: number;
    branches: BranchSummary[];
  }> {
    const branches = await Branch.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    const branchSummary: BranchSummary[] = [];

    for (const branch of branches) {
      const staffCount = await User.count({
        where: { branch_id: branch.id },
      });

      const totalStock = await Stock.sum("quantity", {
        where: { branch_id: branch.id },
      });

      branchSummary.push({
        id: branch.id,
        name: branch.name,
        staff_count: staffCount,
        stock_quantity: Number(totalStock) || 0,
      });
    }

    return {
      total_branches: branches.length,
      branches: branchSummary,
    };
  }

  /**
   * Get overall branch statistics across all branches
   */
  static async getOverallBranchStats(sequelize: Sequelize): Promise<{
    total_branches: number;
    total_staff: number;
    total_stock: number;
    total_revenue: number;
  }> {
    try {
      // Get total branches
      const totalBranches = await Branch.count();

      // Get total staff (users assigned to branches)
      const totalStaff = await User.count({
        where: {
          branch_id: { [Op.not]: null },
        },
      });

      // Get total stock across all branches
      const totalStockResult = await Stock.sum("quantity");
      const totalStock = Number(totalStockResult) || 0;

      // Get total revenue from sales (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const totalRevenueResult = await Sale.sum("total_amount", {
        where: {
          created_at: {
            [Op.gte]: thirtyDaysAgo,
          },
        },
      });
      const totalRevenue = Number(totalRevenueResult) || 0;

      return {
        total_branches: totalBranches,
        total_staff: totalStaff,
        total_stock: totalStock,
        total_revenue: totalRevenue,
      };
    } catch (error: any) {
      logger.error(`Error in getOverallBranchStats: ${error.message}`);
      // Return default values on error
      const totalBranches = await Branch.count();
      return {
        total_branches: totalBranches,
        total_staff: 0,
        total_stock: 0,
        total_revenue: 0,
      };
    }
  }

  /**
   * Get branch specific statistics (simplified version)
   */
  static async getBranchSpecificStats(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<{
    branch: {
      id: number;
      name: string;
      address: string | null;
      phone: string | null;
    };
    statistics: {
      total_staff: number;
      total_stock_items: number;
      total_stock_quantity: number;
      sales_last_30_days: number;
      revenue_last_30_days: number;
    };
  }> {
    // Check if branch exists
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Get branch specific stats
    const staffCount = await User.count({
      where: { branch_id: branchId },
    });

    const stockCount = await Stock.count({
      where: { branch_id: branchId },
    });

    const totalStock = await Stock.sum("quantity", {
      where: { branch_id: branchId },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesCount = await Sale.count({
      where: {
        branch_id: branchId,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const totalRevenue = await Sale.sum("total_amount", {
      where: {
        branch_id: branchId,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
    });

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
      },
      statistics: {
        total_staff: staffCount,
        total_stock_items: stockCount,
        total_stock_quantity: Number(totalStock) || 0,
        sales_last_30_days: salesCount,
        revenue_last_30_days: Number(totalRevenue) || 0,
      },
    };
  }

  /**
   * Check if branch has any dependencies
   */
  static async checkBranchDependencies(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<{
    has_dependencies: boolean;
    dependencies: {
      users: number;
      stock_items: number;
      sales: number;
      purchases: number;
      loans: number;
      bank_accounts: number;
    };
    can_delete: boolean;
  }> {
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const stats = await this.getBranchStatistics(sequelize, branchId);

    const hasDependencies =
      stats.stats.total_users > 0 ||
      stats.stats.total_stock_items > 0 ||
      stats.stats.total_sales > 0 ||
      stats.stats.total_purchases > 0 ||
      stats.stats.active_loans > 0 ||
      stats.stats.total_bank_accounts > 0;

    return {
      has_dependencies: hasDependencies,
      dependencies: {
        users: stats.stats.total_users,
        stock_items: stats.stats.total_stock_items,
        sales: stats.stats.total_sales,
        purchases: stats.stats.total_purchases,
        loans: stats.stats.active_loans,
        bank_accounts: stats.stats.total_bank_accounts,
      },
      can_delete: !hasDependencies,
    };
  }

  /**
   * Get branch by ID with error handling (throws if not found)
   */
  static async getBranchOrThrow(
    sequelize: Sequelize,
    branchId: number,
    includeStats: boolean = false,
  ): Promise<Branch | BranchWithStats> {
    const branch = await this.getBranch(sequelize, branchId, includeStats);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }
    return branch;
  }

  /**
   * Get branch count
   */
  static async getBranchCount(sequelize: Sequelize): Promise<number> {
    return await Branch.count();
  }

  /**
   * Get branches with active users
   */
  static async getActiveBranches(
    sequelize: Sequelize,
  ): Promise<Array<{ branch: Branch; user_count: number }>> {
    const branches = await Branch.findAll();
    const activeBranches = [];

    for (const branch of branches) {
      const userCount = await User.count({
        where: { branch_id: branch.id, active: true },
      });

      if (userCount > 0) {
        activeBranches.push({
          branch,
          user_count: userCount,
        });
      }
    }

    return activeBranches;
  }

  /**
   * Search branches by name or phone
   */
  static async searchBranches(
    sequelize: Sequelize,
    query: string,
  ): Promise<Branch[]> {
    return await Branch.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { phone: { [Op.like]: `%${query}%` } },
        ],
      },
      order: [["name", "ASC"]],
      limit: 20,
    });
  }
}
