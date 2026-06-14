import { Sequelize, Op } from "sequelize";
import { BulkProduct, BulkProductAttributes } from "../models/bulk_product.js";
import { BulkStock } from "../models/bulk_stock.js";
import { BulkStockMovement } from "../models/bulk_stock_movement.js";
import { BulkAlert } from "../models/bulk_alert.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";
import { Branch } from "../models/branch.js";

// Interface for bulk product creation data
export interface CreateBulkProductData {
  name: string;
  description?: string | null;
  unit_of_measure?: string;
  buying_price: number;
  price: number;
  category_options?: string[];
  active?: boolean;
}

// Interface for bulk product update data (all fields optional)
export interface UpdateBulkProductData {
  name?: string;
  description?: string | null;
  unit_of_measure?: string;
  buying_price?: number;
  price?: number;
  category_options?: string[];
  active?: boolean;
}

// Interface for bulk product with stock info
export interface BulkProductWithStock extends BulkProductAttributes {
  total_stock_area?: number;
  stock_by_category?: Record<string, number>;
  reorder_level?: number;
}

// Interface for stock update data
export interface UpdateBulkStockData {
  branch_id: number;
  category?: string | null;
  quantity_change: number;
  type: "purchase" | "sale" | "return" | "adjustment";
  reference_id?: number | null;
  reference_type?: string | null;
  notes?: string | null;
}

export class BulkProductService {
  /**
   * Create a new bulk product
   */
  static async createBulkProduct(
    sequelize: Sequelize,
    productData: CreateBulkProductData,
  ): Promise<BulkProduct> {
    // Validate required fields
    if (!productData.name) {
      throw new AppError("Product name is required", 400);
    }

    if (productData.buying_price <= 0) {
      throw new AppError("Buying price must be greater than 0", 400);
    }

    if (productData.price <= 0) {
      throw new AppError("Selling price must be greater than 0", 400);
    }

    // Check if product with same name already exists
    const existing = await BulkProduct.findOne({
      where: { name: productData.name },
    });

    if (existing) {
      throw new AppError(`Product "${productData.name}" already exists`, 400);
    }

    // Create the bulk product
    const product = await BulkProduct.create({
      name: productData.name,
      description: productData.description || null,
      unit_of_measure: productData.unit_of_measure || "m²",
      buying_price: productData.buying_price,
      price: productData.price,
      category_options: productData.category_options || [],
      active: productData.active !== undefined ? productData.active : true,
    });

    logger.info(
      `Bulk product created: ${product.name} - ${product.unit_of_measure}`,
    );
    return product;
  }

  /**
   * Get all bulk products with optional filtering
   */
  static async getBulkProducts(
    sequelize: Sequelize,
    options?: {
      active?: boolean;
      branchId?: number | undefined;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<BulkProductWithStock[]> {
    const { active = true, branchId, search, limit, offset } = options || {};

    // Build where clause
    const where: any = {};
    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        // Search within category_options array
        { category_options: { [Op.contains]: [search] } },
      ];
    }

    // Fetch products
    const queryOptions: any = {
      where,
      order: [["name", "ASC"]],
    };

    if (limit) queryOptions.limit = limit;
    if (offset) queryOptions.offset = offset;

    const products = await BulkProduct.findAll(queryOptions);

    // If branchId is provided, add stock information
    if (branchId) {
      const productsWithStock: BulkProductWithStock[] = [];

      for (const product of products) {
        // Get stock for this product and branch
        const stocks = await BulkStock.findAll({
          where: {
            branch_id: branchId,
            bulk_product_id: product.id,
          },
        });

        // Calculate total stock area
        const totalStockArea = stocks.reduce(
          (sum, stock) => sum + Number(stock.total_area),
          0,
        );

        // Group stock by category
        const stockByCategory: Record<string, number> = {};
        stocks.forEach((stock) => {
          const category = stock.category || "uncategorized";
          stockByCategory[category] =
            (stockByCategory[category] || 0) + Number(stock.total_area);
        });

        // Get reorder level (use first stock's reorder level or default)
        const reorderLevel =
          stocks.length > 0 ? Number(stocks[0]?.reorder_level) : 10;

        productsWithStock.push({
          ...product.toJSON(),
          total_stock_area: totalStockArea,
          stock_by_category: stockByCategory,
          reorder_level: reorderLevel,
        });
      }

      return productsWithStock;
    }

    return products.map((p) => p.toJSON());
  }

  /**
   * Get a single bulk product by ID
   */
  static async getBulkProduct(
    sequelize: Sequelize,
    productId: number,
    branchId?: number,
  ): Promise<BulkProductWithStock | null> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return null;
    }

    // If branchId is provided, add stock information
    if (branchId) {
      const stocks = await BulkStock.findAll({
        where: {
          branch_id: branchId,
          bulk_product_id: product.id,
        },
      });

      const totalStockArea = stocks.reduce(
        (sum, stock) => sum + Number(stock.total_area),
        0,
      );

      const stockByCategory: Record<string, number> = {};
      stocks.forEach((stock) => {
        const category = stock.category || "uncategorized";
        stockByCategory[category] =
          (stockByCategory[category] || 0) + Number(stock.total_area);
      });

      const reorderLevel =
        stocks.length > 0 ? Number(stocks[0]?.reorder_level) : 10;

      return {
        ...product.toJSON(),
        total_stock_area: totalStockArea,
        stock_by_category: stockByCategory,
        reorder_level: reorderLevel,
      };
    }

    return product.toJSON();
  }

  /**
   * Get bulk product by name
   */
  static async getBulkProductByName(
    sequelize: Sequelize,
    name: string,
    branchId?: number,
  ): Promise<BulkProductWithStock | null> {
    const product = await BulkProduct.findOne({
      where: { name },
    });

    if (!product) {
      return null;
    }

    // If branchId is provided, add stock information
    if (branchId) {
      const stocks = await BulkStock.findAll({
        where: {
          branch_id: branchId,
          bulk_product_id: product.id,
        },
      });

      const totalStockArea = stocks.reduce(
        (sum, stock) => sum + Number(stock.total_area),
        0,
      );

      const stockByCategory: Record<string, number> = {};
      stocks.forEach((stock) => {
        const category = stock.category || "uncategorized";
        stockByCategory[category] =
          (stockByCategory[category] || 0) + Number(stock.total_area);
      });

      return {
        ...product.toJSON(),
        total_stock_area: totalStockArea,
        stock_by_category: stockByCategory,
      };
    }

    return product.toJSON();
  }

  /**
   * Update a bulk product
   */
  static async updateBulkProduct(
    sequelize: Sequelize,
    productId: number,
    productData: UpdateBulkProductData,
  ): Promise<BulkProduct | null> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return null;
    }

    // If name is being updated, check for duplicates
    if (productData.name && productData.name !== product.name) {
      const existing = await BulkProduct.findOne({
        where: {
          name: productData.name,
          id: { [Op.ne]: productId },
        },
      });

      if (existing) {
        throw new AppError(`Product "${productData.name}" already exists`, 400);
      }
    }

    // Validate prices if being updated
    if (
      productData.buying_price !== undefined &&
      productData.buying_price <= 0
    ) {
      throw new AppError("Buying price must be greater than 0", 400);
    }

    if (productData.price !== undefined && productData.price <= 0) {
      throw new AppError("Selling price must be greater than 0", 400);
    }

    // Update only the fields that are provided
    const updateFields: any = {};
    if (productData.name !== undefined) updateFields.name = productData.name;
    if (productData.description !== undefined)
      updateFields.description = productData.description;
    if (productData.unit_of_measure !== undefined)
      updateFields.unit_of_measure = productData.unit_of_measure;
    if (productData.buying_price !== undefined)
      updateFields.buying_price = productData.buying_price;
    if (productData.price !== undefined) updateFields.price = productData.price;
    if (productData.category_options !== undefined)
      updateFields.category_options = productData.category_options;
    if (productData.active !== undefined)
      updateFields.active = productData.active;

    await BulkProduct.update(updateFields, {
      where: { id: productId },
    });

    const updatedProduct = await BulkProduct.findByPk(productId);
    logger.info(`Bulk product updated: ID ${productId}`);

    return updatedProduct;
  }

  /**
   * Delete a bulk product (hard delete)
   */
  static async deleteBulkProduct(
    sequelize: Sequelize,
    productId: number,
  ): Promise<boolean> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return false;
    }

    // Check if product has any stock records
    const stockCount = await BulkStock.count({
      where: { bulk_product_id: productId },
    });

    if (stockCount > 0) {
      throw new AppError(
        `Cannot delete product with existing stock records. ${stockCount} stock record(s) found.`,
        400,
      );
    }

    await product.destroy();
    logger.info(`Bulk product deleted: ID ${productId}`);

    return true;
  }

  /**
   * Soft delete a bulk product (just mark as inactive)
   */
  static async softDeleteBulkProduct(
    sequelize: Sequelize,
    productId: number,
  ): Promise<boolean> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return false;
    }

    product.active = false;
    await product.save();

    logger.info(`Bulk product soft deleted: ID ${productId}`);
    return true;
  }

  /**
   * Activate a bulk product
   */
  static async activateBulkProduct(
    sequelize: Sequelize,
    productId: number,
  ): Promise<boolean> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return false;
    }

    product.active = true;
    await product.save();

    logger.info(`Bulk product activated: ID ${productId}`);
    return true;
  }

  /**
   * Update stock for a bulk product
   */
  static async updateBulkStock(
    sequelize: Sequelize,
    stockData: UpdateBulkStockData,
  ): Promise<BulkStock> {
    const {
      branch_id,
      category,
      quantity_change,
      type,
      reference_id,
      reference_type,
      notes,
    } = stockData;

    // Find or create stock record
    let stock = await BulkStock.findOne({
      where: {
        branch_id,
        bulk_product_id:
          stockData.reference_id || (await this.getBulkProductIdFromContext()),
        category: category || null,
      },
    });

    if (!stock) {
      // Create new stock record
      stock = await BulkStock.create({
        branch_id,
        bulk_product_id: stockData.reference_id!,
        category: category || null,
        total_area: 0,
        reorder_level: 10,
      });
    }

    // Update stock quantity
    const oldQuantity = Number(stock.total_area);
    const newQuantity = oldQuantity + quantity_change;

    if (newQuantity < 0) {
      throw new AppError(
        `Insufficient stock. Available: ${oldQuantity} ${"m²"}`,
        400,
      );
    }

    stock.total_area = newQuantity;
    await stock.save();

    // Create stock movement record
    await BulkStockMovement.create({
      bulk_stock_id: stock.id,
      quantity: quantity_change,
      type,
      reference_id: reference_id || null,
      reference_type: reference_type || null,
      notes: notes || null,
    });

    // Check if stock is low and create alert
    if (newQuantity <= stock.reorder_level && newQuantity > 0) {
      const product = await BulkProduct.findByPk(stock.bulk_product_id);
      await BulkAlert.create({
        bulk_product_id: stock.bulk_product_id,
        branch_id: branch_id,
        category: category || null,
        message: `Low stock alert: ${product?.name || "Product"} ${category ? `(${category})` : ""} has ${newQuantity} ${stock.unit_of_measure || "m²"} remaining. Reorder level is ${stock.reorder_level} ${stock.unit_of_measure || "m²"}.`,
        is_read: false,
      });

      logger.warn(
        `Low stock alert created for product ID ${stock.bulk_product_id}, branch ${branch_id}`,
      );
    }

    logger.info(
      `Stock updated for bulk product: ${stock.bulk_product_id}, change: ${quantity_change}, new total: ${newQuantity}`,
    );
    return stock;
  }

  /**
   * Get stock for a bulk product by branch and category
   */
  static async getBulkStock(
    sequelize: Sequelize,
    productId: number,
    branchId?: number,
    category?: string,
  ): Promise<BulkStock[]> {
    const where: any = { bulk_product_id: productId };

    if (branchId) {
      where.branch_id = branchId;
    }

    if (category !== undefined) {
      where.category = category;
    }

    const stocks = await BulkStock.findAll({
      where,
      include: [
        {
          model: Branch,
          as: "branch",
          attributes: ["id", "name"],
        },
      ],
    });

    return stocks;
  }

  /**
   * Update reorder level for stock
   */
  static async updateReorderLevel(
    sequelize: Sequelize,
    stockId: number,
    reorderLevel: number,
  ): Promise<BulkStock | null> {
    if (reorderLevel < 0) {
      throw new AppError("Reorder level cannot be negative", 400);
    }

    const stock = await BulkStock.findByPk(stockId);

    if (!stock) {
      return null;
    }

    stock.reorder_level = reorderLevel;
    await stock.save();

    logger.info(
      `Reorder level updated for stock ID ${stockId} to ${reorderLevel}`,
    );
    return stock;
  }

  /**
   * Bulk create products
   */
  static async bulkCreateBulkProducts(
    sequelize: Sequelize,
    productsData: CreateBulkProductData[],
  ): Promise<BulkProduct[]> {
    const createdProducts: BulkProduct[] = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const productData of productsData) {
      try {
        const product = await this.createBulkProduct(sequelize, productData);
        createdProducts.push(product);
      } catch (error: any) {
        errors.push({
          name: productData.name,
          error: error.message,
        });
      }
    }

    if (errors.length > 0) {
      logger.warn(`Bulk create completed with ${errors.length} errors`);
    }

    return createdProducts;
  }

  /**
   * Get bulk product count with filters
   */
  static async getBulkProductCount(
    sequelize: Sequelize,
    options?: {
      active?: boolean;
      search?: string;
    },
  ): Promise<number> {
    const { active = true, search } = options || {};

    const where: any = {};
    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    return await BulkProduct.count({ where });
  }

  /**
   * Get products with low stock for a specific branch
   */
  static async getLowStockBulkProducts(
    sequelize: Sequelize,
    branchId: number,
    threshold?: number,
  ): Promise<
    Array<
      BulkProduct & {
        current_stock_area: number;
        reorder_level: number;
        category?: string;
      }
    >
  > {
    const stocks = await BulkStock.findAll({
      where: {
        branch_id: branchId,
        [Op.and]: sequelize.literal("total_area <= reorder_level"),
      },
      include: [
        {
          model: BulkProduct,
          as: "product",
          where: { active: true },
        },
      ],
    });

    return stocks.map((stock) => ({
      ...(stock as any).product.toJSON(),
      current_stock_area: Number(stock.total_area),
      reorder_level: Number(stock.reorder_level),
      category: stock.category || undefined,
    }));
  }

  /**
   * Get stock movement history for a product
   */
  static async getStockMovementHistory(
    sequelize: Sequelize,
    productId: number,
    branchId?: number,
    limit?: number,
  ): Promise<BulkStockMovement[]> {
    const stockIds = await BulkStock.findAll({
      where: {
        bulk_product_id: productId,
        ...(branchId && { branch_id: branchId }),
      },
      attributes: ["id"],
    });

    const stockIdList = stockIds.map((s) => s.id);

    if (stockIdList.length === 0) {
      return [];
    }

    const movements = await BulkStockMovement.findAll({
      where: {
        bulk_stock_id: { [Op.in]: stockIdList },
      },
      order: [["created_at", "DESC"]],
      ...(limit && { limit }),
    });

    return movements;
  }

  /**
   * Helper method to get bulk product ID from context (for stock updates)
   */
  private static async getBulkProductIdFromContext(): Promise<number> {
    // This should be implemented based on your needs
    // For now, throw an error
    throw new AppError("Bulk product ID is required for stock update", 400);
  }

  /**
   * Add category to a bulk product
   */
  static async addCategory(
    sequelize: Sequelize,
    productId: number,
    category: string,
  ): Promise<BulkProduct | null> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return null;
    }

    if (!category.trim()) {
      throw new AppError("Category cannot be empty", 400);
    }

    if (!product.category_options.includes(category)) {
      product.category_options.push(category);
      await product.save();
      logger.info(`Category "${category}" added to product ID ${productId}`);
    }

    return product;
  }

  /**
   * Remove category from a bulk product
   */
  static async removeCategory(
    sequelize: Sequelize,
    productId: number,
    category: string,
  ): Promise<BulkProduct | null> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      return null;
    }

    // Check if any stock exists for this category
    const stockWithCategory = await BulkStock.findOne({
      where: {
        bulk_product_id: productId,
        category: category,
        total_area: { [Op.gt]: 0 },
      },
    });

    if (stockWithCategory) {
      throw new AppError(
        `Cannot remove category "${category}" because there is existing stock for it`,
        400,
      );
    }

    product.category_options = product.category_options.filter(
      (c) => c !== category,
    );
    await product.save();

    logger.info(`Category "${category}" removed from product ID ${productId}`);
    return product;
  }

  /**
   * Get categories for a bulk product
   */
  static async getCategories(
    sequelize: Sequelize,
    productId: number,
  ): Promise<string[]> {
    const product = await BulkProduct.findByPk(productId);

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return product.category_options || [];
  }
}
