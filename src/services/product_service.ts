import { Sequelize, Op } from "sequelize";
import { Product, ProductAttributes } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

// Interface for product creation data
export interface CreateProductData {
  sku: string;
  name: string;
  description?: string | null;
  color?: string | null;
  size?: string | null;
  pages?: number | null;
  price: number;
  cost: number;
  active?: boolean;
}

// Interface for product update data (all fields optional)
export interface UpdateProductData {
  sku?: string;
  name?: string;
  description?: string | null;
  color?: string | null;
  size?: string | null;
  pages?: number | null;
  price?: number;
  cost?: number;
  active?: boolean;
}

// Interface for product with stock info
export interface ProductWithStock extends ProductAttributes {
  stock_quantity?: number;
  reorder_level?: number;
}

export class ProductService {
  /**
   * Create a new product
   */
  static async createProduct(
    sequelize: Sequelize,
    productData: CreateProductData,
  ): Promise<Product> {
    // Check if SKU already exists
    const existing = await Product.findOne({
      where: { sku: productData.sku },
    });

    if (existing) {
      throw new AppError(`SKU "${productData.sku}" already exists`, 400);
    }

    // Create the product
    const product = await Product.create({
      sku: productData.sku,
      name: productData.name,
      description: productData.description || null,
      color: productData.color || null,
      size: productData.size || null,
      pages: productData.pages || null,
      price: productData.price,
      cost: productData.cost,
      active: productData.active !== undefined ? productData.active : true,
    });

    logger.info(`Product created: ${product.sku} - ${product.name}`);
    return product;
  }

  /**
   * Get all products with optional filtering
   */
  static async getProducts(
    sequelize: Sequelize,
    options?: {
      active?: boolean;
      branchId?: number | undefined;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<ProductWithStock[]> {
    const { active = true, branchId, search, limit, offset } = options || {};

    // Build where clause
    const where: any = {};
    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Fetch products
    const queryOptions: any = {
      where,
      order: [["name", "ASC"]],
    };

    if (limit) queryOptions.limit = limit;
    if (offset) queryOptions.offset = offset;

    const products = await Product.findAll(queryOptions);

    // If branchId is provided, add stock information
    if (branchId) {
      const productsWithStock: ProductWithStock[] = [];

      for (const product of products) {
        const stock = await Stock.findOne({
          where: {
            branch_id: branchId,
            product_id: product.id,
          },
        });

        productsWithStock.push({
          ...product.toJSON(),
          stock_quantity: stock ? Number(stock.quantity) : 0,
          reorder_level: stock ? Number(stock.reorder_level) : 0,
        });
      }

      return productsWithStock;
    }

    return products.map((p) => p.toJSON());
  }

  /**
   * Get a single product by ID
   */
  static async getProduct(
    sequelize: Sequelize,
    productId: number,
    branchId?: number,
  ): Promise<ProductWithStock | null> {
    const product = await Product.findByPk(productId);

    if (!product) {
      return null;
    }

    // If branchId is provided, add stock information
    if (branchId) {
      const stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: product.id,
        },
      });

      return {
        ...product.toJSON(),
        stock_quantity: stock ? Number(stock.quantity) : 0,
        reorder_level: stock ? Number(stock.reorder_level) : 0,
      };
    }

    return product.toJSON();
  }

  /**
   * Get product by SKU
   */
  static async getProductBySku(
    sequelize: Sequelize,
    sku: string,
    branchId?: number,
  ): Promise<ProductWithStock | null> {
    const product = await Product.findOne({
      where: { sku },
    });

    if (!product) {
      return null;
    }

    // If branchId is provided, add stock information
    if (branchId) {
      const stock = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: product.id,
        },
      });

      return {
        ...product.toJSON(),
        stock_quantity: stock ? Number(stock.quantity) : 0,
        reorder_level: stock ? Number(stock.reorder_level) : 0,
      };
    }

    return product.toJSON();
  }

  /**
   * Update a product
   */
  static async updateProduct(
    sequelize: Sequelize,
    productId: number,
    productData: UpdateProductData,
  ): Promise<Product | null> {
    const product = await this.getProduct(sequelize, productId);

    if (!product) {
      return null;
    }

    // If SKU is being updated, check for duplicates
    if (productData.sku && productData.sku !== product.sku) {
      const existing = await Product.findOne({
        where: {
          sku: productData.sku,
          id: { [Op.ne]: productId },
        },
      });

      if (existing) {
        throw new AppError(`SKU "${productData.sku}" already exists`, 400);
      }
    }

    // Update only the fields that are provided
    const updateFields: any = {};
    if (productData.sku !== undefined) updateFields.sku = productData.sku;
    if (productData.name !== undefined) updateFields.name = productData.name;
    if (productData.description !== undefined)
      updateFields.description = productData.description;
    if (productData.color !== undefined) updateFields.color = productData.color;
    if (productData.size !== undefined) updateFields.size = productData.size;
    if (productData.pages !== undefined) updateFields.pages = productData.pages;
    if (productData.price !== undefined) updateFields.price = productData.price;
    if (productData.cost !== undefined) updateFields.cost = productData.cost;
    if (productData.active !== undefined)
      updateFields.active = productData.active;

    await Product.update(updateFields, {
      where: { id: productId },
    });

    const updatedProduct = await Product.findByPk(productId);
    logger.info(`Product updated: ID ${productId}`);

    return updatedProduct;
  }

  /**
   * Delete a product (hard delete)
   */
  static async deleteProduct(
    sequelize: Sequelize,
    productId: number,
  ): Promise<boolean> {
    const product = await Product.findByPk(productId);

    if (!product) {
      return false;
    }

    // Check if product has any stock records
    const stockCount = await Stock.count({
      where: { product_id: productId },
    });

    if (stockCount > 0) {
      throw new AppError(
        `Cannot delete product with existing stock records. ${stockCount} stock record(s) found.`,
        400,
      );
    }

    await product.destroy();
    logger.info(`Product deleted: ID ${productId}`);

    return true;
  }

  /**
   * Soft delete a product (just mark as inactive)
   */
  static async softDeleteProduct(
    sequelize: Sequelize,
    productId: number,
  ): Promise<boolean> {
    const product = await Product.findByPk(productId);

    if (!product) {
      return false;
    }

    product.active = false;
    await product.save();

    logger.info(`Product soft deleted: ID ${productId}`);
    return true;
  }

  /**
   * Activate a product
   */
  static async activateProduct(
    sequelize: Sequelize,
    productId: number,
  ): Promise<boolean> {
    const product = await Product.findByPk(productId);

    if (!product) {
      return false;
    }

    product.active = true;
    await product.save();

    logger.info(`Product activated: ID ${productId}`);
    return true;
  }

  /**
   * Bulk create products
   */
  static async bulkCreateProducts(
    sequelize: Sequelize,
    productsData: CreateProductData[],
  ): Promise<Product[]> {
    const createdProducts: Product[] = [];
    const errors: Array<{ sku: string; error: string }> = [];

    for (const productData of productsData) {
      try {
        const product = await this.createProduct(sequelize, productData);
        createdProducts.push(product);
      } catch (error: any) {
        errors.push({
          sku: productData.sku,
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
   * Get product count with filters
   */
  static async getProductCount(
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
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }

    return await Product.count({ where });
  }

  /**
   * Get products with low stock for a specific branch
   */
  static async getLowStockProducts(
    sequelize: Sequelize,
    branchId: number,
    threshold?: number,
  ): Promise<
    Array<Product & { current_stock: number; reorder_level: number }>
  > {
    const stocks = await Stock.findAll({
      where: {
        branch_id: branchId,
        [Op.and]: sequelize.literal("quantity <= reorder_level"),
      },
      include: [
        {
          model: Product,
          as: "product",
          where: { active: true },
        },
      ],
    });

    return stocks.map((stock) => ({
      ...(stock as any).product.toJSON(),
      current_stock: Number(stock.quantity),
      reorder_level: Number(stock.reorder_level),
    }));
  }
}
