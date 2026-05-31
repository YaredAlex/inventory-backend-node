import { Router, Request, Response } from "express";
import { Sequelize, Op } from "sequelize";
import { database } from "../database.js";
import { Product } from "../models/product.js";
import { Stock } from "../models/stock.js";
import { Branch } from "../models/branch.js";
import { SaleItem } from "../models/sale_item.js";
import { PurchaseItem } from "../models/purchase_item.js";
import { PurchaseOrderItem } from "../models/purchase_order_item.js";
import { Alert } from "../models/alert.js";
import { ProductService } from "../services/product_service.js";
import {
  validateProductCreate,
  validateProductUpdate,
  ProductResponse,
} from "../schemas/product.js";
import { requireAuth, requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All product routes require authentication
router.use(requireAuth);

// ==================== READ OPERATIONS (Any authenticated user) ====================

// GET - Get all products (handle both with and without trailing slash)
router.get(
  ["/", ""],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const active =
      req.query.active === "true"
        ? true
        : req.query.active === "false"
          ? false
          : true;
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const currentUser = (req as any).user;

    // If user is salesman, they can only see their branch
    let finalBranchId = branchId;
    if (currentUser.role === "salesman") {
      finalBranchId = currentUser.branch_id;
    }

    const products = await ProductService.getProducts(database.sequelize!, {
      active,
      branchId: finalBranchId,
    });

    // Convert to response format with stock info
    const response: ProductResponse[] = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      color: p.color,
      size: p.size,
      pages: p.pages,
      price: Number(p.price),
      cost: Number(p.cost),
      active: p.active,
      created_at: p.created_at,
      stock_quantity: (p as any).stock_quantity,
      reorder_level: (p as any).reorder_level,
    }));

    res.json(response);
  }),
);

// GET by ID - Get single product
router.get(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const currentUser = (req as any).user;
    const branchId =
      currentUser.role === "salesman" ? currentUser.branch_id : undefined;

    const product = await ProductService.getProduct(
      database.sequelize!,
      productId,
      branchId,
    );

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const response: ProductResponse = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      color: product.color,
      size: product.size,
      pages: product.pages,
      price: Number(product.price),
      cost: Number(product.cost),
      active: product.active,
      created_at: product.created_at,
      stock_quantity: (product as any).stock_quantity,
      reorder_level: (product as any).reorder_level,
    };

    res.json(response);
  }),
);

// ==================== WRITE OPERATIONS (Admin only) ====================

// POST - Create product (handle both with and without trailing slash)
router.post(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productData = validateProductCreate(req.body);

    try {
      // Create the product
      const newProduct = await ProductService.createProduct(
        database.sequelize!,
        productData,
      );

      // Get all branches and create stock records
      const branches = await Branch.findAll();

      for (const branch of branches) {
        // Check if stock already exists
        const existingStock = await Stock.findOne({
          where: {
            branch_id: branch.id,
            product_id: newProduct.id,
          },
        });

        if (!existingStock) {
          await Stock.create({
            branch_id: branch.id,
            product_id: newProduct.id,
            quantity: 0,
            quantity_with_vat: 0,
            quantity_without_vat: 0,
            reorder_level: 10, // Default reorder level
          });
        }
      }

      logger.info(`Product created with stock records: ${newProduct.sku}`);

      const response: ProductResponse = {
        id: newProduct.id,
        sku: newProduct.sku,
        name: newProduct.name,
        description: newProduct.description,
        color: newProduct.color,
        size: newProduct.size,
        pages: newProduct.pages,
        price: Number(newProduct.price),
        cost: Number(newProduct.cost),
        active: newProduct.active,
        created_at: newProduct.created_at,
      };

      res.status(201).json(response);
    } catch (error: any) {
      if (error.message.includes("SKU already exists")) {
        throw new AppError(error.message, 400);
      }
      throw error;
    }
  }),
);

// PUT - Update product
router.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const productData = validateProductUpdate(req.body);

    const updatedProduct = await ProductService.updateProduct(
      database.sequelize!,
      productId,
      productData,
    );

    if (!updatedProduct) {
      throw new AppError("Product not found", 404);
    }

    const response: ProductResponse = {
      id: updatedProduct.id,
      sku: updatedProduct.sku,
      name: updatedProduct.name,
      description: updatedProduct.description,
      color: updatedProduct.color,
      size: updatedProduct.size,
      pages: updatedProduct.pages,
      price: Number(updatedProduct.price),
      cost: Number(updatedProduct.cost),
      active: updatedProduct.active,
      created_at: updatedProduct.created_at,
    };

    res.json(response);
  }),
);

// DELETE - Delete product (Hard delete with all relations)
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const transaction = await database.sequelize!.transaction();

    try {
      // 1. Delete stock records for this product across all branches
      await Stock.destroy({
        where: { product_id: productId },
        transaction,
      });

      // 2. Delete sale items referencing this product
      await SaleItem.destroy({
        where: { product_id: productId },
        transaction,
      });

      // 3. Delete purchase items referencing this product
      await PurchaseItem.destroy({
        where: { product_id: productId },
        transaction,
      });

      // 4. Delete purchase order items referencing this product
      await PurchaseOrderItem.destroy({
        where: { product_id: productId },
        transaction,
      });

      // 5. Delete alerts related to this product
      await Alert.destroy({
        where: { product_id: productId },
        transaction,
      });

      // 6. Finally, delete the product itself
      await product.destroy({ transaction });

      await transaction.commit();
      logger.info(`Product deleted: ID ${productId}`);

      res.status(204).send();
    } catch (error: any) {
      await transaction.rollback();
      logger.error(`Failed to delete product: ${error.message}`);
      throw new AppError(`Failed to delete product: ${error.message}`, 500);
    }
  }),
);

// ==================== STOCK INITIALIZATION ENDPOINTS ====================

// POST - Initialize stock for all existing products
router.post(
  "/initialize-stock",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = (req as any).user;

    // Get all products (including inactive ones)
    const products = await Product.findAll();

    // Get all branches
    const branches = await Branch.findAll();

    const results = {
      total_products: products.length,
      total_branches: branches.length,
      stock_records_created: 0,
      stock_records_skipped: 0,
      errors: [] as any[],
    };

    for (const product of products) {
      for (const branch of branches) {
        try {
          // Check if stock already exists
          const existingStock = await Stock.findOne({
            where: {
              branch_id: branch.id,
              product_id: product.id,
            },
          });

          if (!existingStock) {
            // Create stock record with 0 quantity
            await Stock.create({
              branch_id: branch.id,
              product_id: product.id,
              quantity: 0,
              quantity_with_vat: 0,
              quantity_without_vat: 0,
              reorder_level: 10,
            });

            results.stock_records_created++;

            // Log stock movement
            logger.info(
              `Stock initialized for product ${product.name} at branch ${branch.name}`,
            );
          } else {
            results.stock_records_skipped++;
          }
        } catch (error: any) {
          results.errors.push({
            product_id: product.id,
            product_name: product.name,
            branch_id: branch.id,
            branch_name: branch.name,
            error: error.message,
          });
        }
      }
    }

    res.json({
      message: "Stock initialization completed",
      results,
    });
  }),
);

// POST - Initialize stock for a single product in all branches
router.post(
  "/:productId/initialize-stock",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.productId as string);
    const currentUser = (req as any).user;

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Get all branches
    const branches = await Branch.findAll();

    const results = {
      product_id: productId,
      product_name: product.name,
      total_branches: branches.length,
      stock_records_created: 0,
      stock_records_existing: 0,
      errors: [] as any[],
    };

    for (const branch of branches) {
      try {
        // Check if stock already exists
        const existingStock = await Stock.findOne({
          where: {
            branch_id: branch.id,
            product_id: productId,
          },
        });

        if (!existingStock) {
          // Create stock record with 0 quantity
          await Stock.create({
            branch_id: branch.id,
            product_id: productId,
            quantity: 0,
            quantity_with_vat: 0,
            quantity_without_vat: 0,
            reorder_level: 10,
          });

          results.stock_records_created++;

          logger.info(
            `Stock initialized for product ${product.name} at branch ${branch.name}`,
          );
        } else {
          results.stock_records_existing++;
        }
      } catch (error: any) {
        results.errors.push({
          branch_id: branch.id,
          branch_name: branch.name,
          error: error.message,
        });
      }
    }

    res.json({
      message: `Stock initialization completed for product ${product.name}`,
      results,
    });
  }),
);

// POST - Initialize stock for a single product in a single branch
router.post(
  "/:productId/branches/:branchId/stock",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.productId as string);
    const branchId = parseInt(req.params.branchId as string);
    const currentUser = (req as any).user;

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Check if branch exists
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    // Check if stock already exists
    const existingStock = await Stock.findOne({
      where: {
        branch_id: branchId,
        product_id: productId,
      },
    });

    let stock;
    let created = false;

    if (!existingStock) {
      stock = await Stock.create({
        branch_id: branchId,
        product_id: productId,
        quantity: 0,
        quantity_with_vat: 0,
        quantity_without_vat: 0,
        reorder_level: 10,
      });
      created = true;
      logger.info(
        `Stock initialized for product ${product.name} at branch ${branch.name}`,
      );
    } else {
      stock = existingStock;
    }

    res.status(created ? 201 : 200).json({
      message: created ? "Stock record created" : "Stock record already exists",
      stock: {
        id: stock.id,
        branch_id: stock.branch_id,
        product_id: stock.product_id,
        quantity: Number(stock.quantity),
        reorder_level: Number(stock.reorder_level),
      },
    });
  }),
);

// GET - Get stock for a specific product in a branch
router.get(
  "/:productId/branches/:branchId/stock",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.productId as string);
    const branchId = parseInt(req.params.branchId as string);
    const currentUser = (req as any).user;

    // If user is salesman, they can only see their branch
    if (currentUser.role === "salesman" && currentUser.branch_id !== branchId) {
      throw new AppError("Access denied", 403);
    }

    const stock = await Stock.findOne({
      where: {
        branch_id: branchId,
        product_id: productId,
      },
      include: [
        { model: Product, as: "product", attributes: ["name", "sku"] },
        { model: Branch, as: "branch", attributes: ["name"] },
      ],
    });

    if (!stock) {
      throw new AppError("Stock record not found", 404);
    }

    res.json({
      id: stock.id,
      product_id: stock.product_id,
      product_name: (stock as any).product?.name,
      product_sku: (stock as any).product?.sku,
      branch_id: stock.branch_id,
      branch_name: (stock as any).branch?.name,
      quantity: Number(stock.quantity),
      quantity_with_vat: Number(stock.quantity_with_vat),
      quantity_without_vat: Number(stock.quantity_without_vat),
      reorder_level: Number(stock.reorder_level),
    });
  }),
);

export default router;
