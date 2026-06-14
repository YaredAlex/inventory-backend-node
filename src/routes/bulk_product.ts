import { Router, Request, Response } from "express";
import { Sequelize, Op } from "sequelize";
import { database } from "../database.js";
import { BulkProduct } from "../models/bulk_product.js";
import { BulkStock } from "../models/bulk_stock.js";
import { BulkStockMovement } from "../models/bulk_stock_movement.js";
import { BulkPurchaseOrder } from "../models/bulk_purchase_order.js";
import { BulkPurchaseOrderItem } from "../models/bulk_purchase_order_item.js";
import { BulkSaleItem } from "../models/bulk_sale_item.js";
import { BulkAlert } from "../models/bulk_alert.js";
import { Branch } from "../models/branch.js";
import { BulkProductService } from "../services/bulk_product_service.js";
import {
  validateBulkProductCreate,
  validateBulkProductUpdate,
  BulkProductResponse,
} from "../schemas/bulk_product.js";
import { requireAuth, requireAdmin } from "../utils/dependencies.js";
import { asyncHandler, AppError } from "../middleware/error_handle.js";
import logger from "../services/logger.js";

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// All bulk product routes require authentication
router.use(requireAuth);

// ==================== READ OPERATIONS (Any authenticated user) ====================

// GET - Get all bulk products (handle both with and without trailing slash)
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
    const search = req.query.search as string | undefined;
    const currentUser = (req as any).user;

    // If user is salesman, they can only see their branch
    let finalBranchId = branchId;
    if (currentUser.role === "salesman") {
      finalBranchId = currentUser.branch_id;
    }

    const products = await BulkProductService.getBulkProducts(
      database.sequelize!,
      {
        active,
        branchId: finalBranchId,
        ...(search && { search }), // Only include search if it has a value
      },
    );

    // Convert to response format with stock info
    const response: BulkProductResponse[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      unit_of_measure: p.unit_of_measure,
      buying_price: Number(p.buying_price),
      price: Number(p.price),
      category_options: p.category_options,
      active: p.active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      total_stock_area: (p as any).total_stock_area,
      stock_by_category: (p as any).stock_by_category,
      reorder_level: (p as any).reorder_level,
    }));

    res.json(response);
  }),
);

// GET by ID - Get single bulk product
router.get(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const currentUser = (req as any).user;
    const branchId =
      currentUser.role === "salesman" ? currentUser.branch_id : undefined;

    const product = await BulkProductService.getBulkProduct(
      database.sequelize!,
      productId,
      branchId,
    );

    if (!product) {
      throw new AppError("Bulk product not found", 404);
    }

    const response: BulkProductResponse = {
      id: product.id,
      name: product.name,
      description: product.description,
      unit_of_measure: product.unit_of_measure,
      buying_price: Number(product.buying_price),
      price: Number(product.price),
      category_options: product.category_options,
      active: product.active,
      created_at: product.created_at,
      updated_at: product.updated_at,
      total_stock_area: (product as any).total_stock_area,
      stock_by_category: (product as any).stock_by_category,
      reorder_level: (product as any).reorder_level,
    };

    res.json(response);
  }),
);

// GET - Get categories for a bulk product
router.get(
  "/:id/categories",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);

    const categories = await BulkProductService.getCategories(
      database.sequelize!,
      productId,
    );

    res.json({ product_id: productId, categories });
  }),
);

// GET - Get stock for a bulk product
router.get(
  "/:id/stock",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const category = req.query.category as string | undefined;
    const currentUser = (req as any).user;

    // If user is salesman, they can only see their branch
    let finalBranchId = branchId;
    if (currentUser.role === "salesman") {
      finalBranchId = currentUser.branch_id;
    }

    const stocks = await BulkProductService.getBulkStock(
      database.sequelize!,
      productId,
      finalBranchId,
      category,
    );

    res.json(
      stocks.map((stock) => ({
        id: stock.id,
        branch_id: stock.branch_id,
        branch_name: (stock as any).branch?.name,
        category: stock.category,
        total_area: Number(stock.total_area),
        reorder_level: Number(stock.reorder_level),
        is_low_stock: Number(stock.total_area) <= Number(stock.reorder_level),
        created_at: stock.created_at,
        updated_at: stock.updated_at,
      })),
    );
  }),
);

// GET - Get stock movement history for a bulk product
router.get(
  "/:id/stock-movements",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const movements = await BulkProductService.getStockMovementHistory(
      database.sequelize!,
      productId,
      branchId,
      limit,
    );

    res.json(movements);
  }),
);

// GET - Low stock products
router.get(
  "/low-stock",
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const currentUser = (req as any).user;
    let branchId = req.query.branch_id
      ? parseInt(req.query.branch_id as string)
      : undefined;

    // If user is salesman, they can only see their branch
    if (currentUser.role === "salesman") {
      branchId = currentUser.branch_id;
    }

    if (!branchId) {
      throw new AppError("Branch ID is required", 400);
    }

    const products = await BulkProductService.getLowStockBulkProducts(
      database.sequelize!,
      branchId,
    );

    res.json(products);
  }),
);

// ==================== WRITE OPERATIONS (Admin only) ====================

// POST - Create bulk product (handle both with and without trailing slash)
router.post(
  ["/", ""],
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productData = validateBulkProductCreate(req.body);

    try {
      // Create the bulk product
      const newProduct = await BulkProductService.createBulkProduct(
        database.sequelize!,
        productData,
      );

      // Get all branches and create stock records
      const branches = await Branch.findAll();

      for (const branch of branches) {
        // Check if stock already exists
        const existingStock = await BulkStock.findOne({
          where: {
            branch_id: branch.id,
            bulk_product_id: newProduct.id,
            category: null, // Default uncategorized stock
          },
        });

        if (!existingStock) {
          await BulkStock.create({
            branch_id: branch.id,
            bulk_product_id: newProduct.id,
            category: null,
            total_area: 0,
            reorder_level: 10,
          });
        }

        // Also create stock records for each category
        if (productData.category_options) {
          for (const category of productData.category_options) {
            const existingCategoryStock = await BulkStock.findOne({
              where: {
                branch_id: branch.id,
                bulk_product_id: newProduct.id,
                category: category,
              },
            });

            if (!existingCategoryStock) {
              await BulkStock.create({
                branch_id: branch.id,
                bulk_product_id: newProduct.id,
                category: category,
                total_area: 0,
                reorder_level: 10,
              });
            }
          }
        }
      }

      logger.info(
        `Bulk product created with stock records: ${newProduct.name}`,
      );

      const response: BulkProductResponse = {
        id: newProduct.id,
        name: newProduct.name,
        description: newProduct.description,
        unit_of_measure: newProduct.unit_of_measure,
        buying_price: Number(newProduct.buying_price),
        price: Number(newProduct.price),
        category_options: newProduct.category_options,
        active: newProduct.active,
        created_at: newProduct.created_at,
        updated_at: newProduct.updated_at,
      };

      res.status(201).json(response);
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        throw new AppError(error.message, 400);
      }
      throw error;
    }
  }),
);

// PUT - Update bulk product
router.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const productData = validateBulkProductUpdate(req.body);

    const updatedProduct = await BulkProductService.updateBulkProduct(
      database.sequelize!,
      productId,
      productData,
    );

    if (!updatedProduct) {
      throw new AppError("Bulk product not found", 404);
    }

    const response: BulkProductResponse = {
      id: updatedProduct.id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      unit_of_measure: updatedProduct.unit_of_measure,
      buying_price: Number(updatedProduct.buying_price),
      price: Number(updatedProduct.price),
      category_options: updatedProduct.category_options,
      active: updatedProduct.active,
      created_at: updatedProduct.created_at,
      updated_at: updatedProduct.updated_at,
    };

    res.json(response);
  }),
);

// DELETE - Delete bulk product (Soft delete - mark as inactive)
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);

    // Check if product exists
    const product = await BulkProduct.findByPk(productId);
    if (!product) {
      throw new AppError("Bulk product not found", 404);
    }

    // Check if product has any stock records with positive quantity
    const stockWithQuantity = await BulkStock.findOne({
      where: {
        bulk_product_id: productId,
        total_area: { [Op.gt]: 0 },
      },
    });

    if (stockWithQuantity) {
      throw new AppError(
        "Cannot delete product with existing stock. Please transfer or sell the stock first.",
        400,
      );
    }

    // Soft delete - just mark as inactive
    const deleted = await BulkProductService.softDeleteBulkProduct(
      database.sequelize!,
      productId,
    );

    if (!deleted) {
      throw new AppError("Bulk product not found", 404);
    }

    logger.info(`Bulk product soft deleted: ID ${productId}`);
    res.status(204).send();
  }),
);

// Hard DELETE - Permanently delete bulk product (Admin only, careful!)
router.delete(
  "/:id/permanent",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const currentUser = (req as any).user;

    // Only super admin can permanently delete
    if (currentUser.role !== "super_admin") {
      throw new AppError(
        "Only super admin can permanently delete products",
        403,
      );
    }

    const transaction = await database.sequelize!.transaction();

    try {
      // Check if product exists
      const product = await BulkProduct.findByPk(productId);
      if (!product) {
        throw new AppError("Bulk product not found", 404);
      }

      // Check if product has any stock records with positive quantity
      const stockWithQuantity = await BulkStock.findOne({
        where: {
          bulk_product_id: productId,
          total_area: { [Op.gt]: 0 },
        },
        transaction,
      });

      if (stockWithQuantity) {
        throw new AppError(
          "Cannot delete product with existing stock. Please transfer or sell the stock first.",
          400,
        );
      }

      // 1. Delete bulk stock movements
      const stocks = await BulkStock.findAll({
        where: { bulk_product_id: productId },
        transaction,
      });

      for (const stock of stocks) {
        await BulkStockMovement.destroy({
          where: { bulk_stock_id: stock.id },
          transaction,
        });
      }

      // 2. Delete bulk stock records
      await BulkStock.destroy({
        where: { bulk_product_id: productId },
        transaction,
      });

      // 3. Delete bulk sale items
      await BulkSaleItem.destroy({
        where: { bulk_product_id: productId },
        transaction,
      });

      // 4. Delete bulk purchase order items
      await BulkPurchaseOrderItem.destroy({
        where: { bulk_product_id: productId },
        transaction,
      });

      // 5. Delete bulk alerts
      await BulkAlert.destroy({
        where: { bulk_product_id: productId },
        transaction,
      });

      // 6. Finally, delete the product itself
      await product.destroy({ transaction });

      await transaction.commit();
      logger.info(`Bulk product permanently deleted: ID ${productId}`);

      res.status(204).send();
    } catch (error: any) {
      await transaction.rollback();
      logger.error(
        `Failed to permanently delete bulk product: ${error.message}`,
      );
      throw new AppError(`Failed to delete product: ${error.message}`, 500);
    }
  }),
);

// ==================== CATEGORY MANAGEMENT ====================

// POST - Add category to bulk product
router.post(
  "/:id/categories",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const { category } = req.body;

    if (!category || typeof category !== "string") {
      throw new AppError("Category name is required", 400);
    }

    const product = await BulkProductService.addCategory(
      database.sequelize!,
      productId,
      category,
    );

    if (!product) {
      throw new AppError("Bulk product not found", 404);
    }

    // Create stock records for the new category in all branches
    const branches = await Branch.findAll();
    for (const branch of branches) {
      const existingStock = await BulkStock.findOne({
        where: {
          branch_id: branch.id,
          bulk_product_id: productId,
          category: category,
        },
      });

      if (!existingStock) {
        await BulkStock.create({
          branch_id: branch.id,
          bulk_product_id: productId,
          category: category,
          total_area: 0,
          reorder_level: 10,
        });
      }
    }

    res.json({
      message: `Category "${category}" added successfully`,
      product: {
        id: product.id,
        name: product.name,
        category_options: product.category_options,
      },
    });
  }),
);

// DELETE - Remove category from bulk product
router.delete(
  "/:id/categories/:category",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.id as string);
    const category = decodeURIComponent(req.params.category as string);

    const product = await BulkProductService.removeCategory(
      database.sequelize!,
      productId,
      category,
    );

    if (!product) {
      throw new AppError("Bulk product not found", 404);
    }

    res.json({
      message: `Category "${category}" removed successfully`,
      product: {
        id: product.id,
        name: product.name,
        category_options: product.category_options,
      },
    });
  }),
);

// ==================== STOCK MANAGEMENT ====================

// PUT - Update stock reorder level
router.put(
  "/stock/:stockId/reorder-level",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stockId = parseInt(req.params.stockId as string);
    const { reorder_level } = req.body;

    if (reorder_level === undefined || reorder_level < 0) {
      throw new AppError("Valid reorder level is required", 400);
    }

    const stock = await BulkProductService.updateReorderLevel(
      database.sequelize!,
      stockId,
      reorder_level,
    );

    if (!stock) {
      throw new AppError("Stock record not found", 404);
    }

    res.json({
      message: "Reorder level updated successfully",
      stock: {
        id: stock.id,
        branch_id: stock.branch_id,
        category: stock.category,
        total_area: Number(stock.total_area),
        reorder_level: Number(stock.reorder_level),
      },
    });
  }),
);

// ==================== STOCK INITIALIZATION ENDPOINTS ====================

// POST - Initialize stock for all existing bulk products
router.post(
  "/initialize-stock",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get all bulk products (including inactive ones)
    const products = await BulkProduct.findAll();

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
          // Create stock for uncategorized
          const existingStock = await BulkStock.findOne({
            where: {
              branch_id: branch.id,
              bulk_product_id: product.id,
              category: null,
            },
          });

          if (!existingStock) {
            await BulkStock.create({
              branch_id: branch.id,
              bulk_product_id: product.id,
              category: null,
              total_area: 0,
              reorder_level: 10,
            });
            results.stock_records_created++;
          } else {
            results.stock_records_skipped++;
          }

          // Create stock for each category
          if (product.category_options && product.category_options.length > 0) {
            for (const category of product.category_options) {
              const existingCategoryStock = await BulkStock.findOne({
                where: {
                  branch_id: branch.id,
                  bulk_product_id: product.id,
                  category: category,
                },
              });

              if (!existingCategoryStock) {
                await BulkStock.create({
                  branch_id: branch.id,
                  bulk_product_id: product.id,
                  category: category,
                  total_area: 0,
                  reorder_level: 10,
                });
                results.stock_records_created++;
              } else {
                results.stock_records_skipped++;
              }
            }
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

    logger.info(
      `Stock initialization completed: ${results.stock_records_created} records created`,
    );
    res.json({
      message: "Stock initialization completed",
      results,
    });
  }),
);

// POST - Initialize stock for a single bulk product in all branches
router.post(
  "/:productId/initialize-stock",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.productId as string);

    // Check if product exists
    const product = await BulkProduct.findByPk(productId);
    if (!product) {
      throw new AppError("Bulk product not found", 404);
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
        // Create stock for uncategorized
        const existingStock = await BulkStock.findOne({
          where: {
            branch_id: branch.id,
            bulk_product_id: productId,
            category: null,
          },
        });

        if (!existingStock) {
          await BulkStock.create({
            branch_id: branch.id,
            bulk_product_id: productId,
            category: null,
            total_area: 0,
            reorder_level: 10,
          });
          results.stock_records_created++;
        } else {
          results.stock_records_existing++;
        }

        // Create stock for each category
        if (product.category_options && product.category_options.length > 0) {
          for (const category of product.category_options) {
            const existingCategoryStock = await BulkStock.findOne({
              where: {
                branch_id: branch.id,
                bulk_product_id: productId,
                category: category,
              },
            });

            if (!existingCategoryStock) {
              await BulkStock.create({
                branch_id: branch.id,
                bulk_product_id: productId,
                category: category,
                total_area: 0,
                reorder_level: 10,
              });
              results.stock_records_created++;
            } else {
              results.stock_records_existing++;
            }
          }
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

// POST - Initialize stock for a single bulk product in a single branch
router.post(
  "/:productId/branches/:branchId/stock",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = parseInt(req.params.productId as string);
    const branchId = parseInt(req.params.branchId as string);

    // Check if product exists
    const product = await BulkProduct.findByPk(productId);
    if (!product) {
      throw new AppError("Bulk product not found", 404);
    }

    // Check if branch exists
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const createdStocks = [];

    // Create stock for uncategorized
    let existingStock = await BulkStock.findOne({
      where: {
        branch_id: branchId,
        bulk_product_id: productId,
        category: null,
      },
    });

    if (!existingStock) {
      existingStock = await BulkStock.create({
        branch_id: branchId,
        bulk_product_id: productId,
        category: null,
        total_area: 0,
        reorder_level: 10,
      });
      createdStocks.push({ category: null, stock: existingStock });
    }

    // Create stock for each category
    if (product.category_options && product.category_options.length > 0) {
      for (const category of product.category_options) {
        let existingCategoryStock = await BulkStock.findOne({
          where: {
            branch_id: branchId,
            bulk_product_id: productId,
            category: category,
          },
        });

        if (!existingCategoryStock) {
          existingCategoryStock = await BulkStock.create({
            branch_id: branchId,
            bulk_product_id: productId,
            category: category,
            total_area: 0,
            reorder_level: 10,
          });
          createdStocks.push({ category, stock: existingCategoryStock });
        }
      }
    }

    res.status(createdStocks.length > 0 ? 201 : 200).json({
      message:
        createdStocks.length > 0
          ? `${createdStocks.length} stock record(s) created`
          : "Stock records already exist",
      stocks: createdStocks.map((item) => ({
        id: item.stock.id,
        branch_id: item.stock.branch_id,
        category: item.category,
        total_area: Number(item.stock.total_area),
        reorder_level: Number(item.stock.reorder_level),
      })),
    });
  }),
);

// GET - Get stock for a specific bulk product in a branch
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

    const stocks = await BulkStock.findAll({
      where: {
        branch_id: branchId,
        bulk_product_id: productId,
      },
      include: [
        {
          model: BulkProduct,
          as: "product",
          attributes: ["name", "unit_of_measure"],
        },
        { model: Branch, as: "branch", attributes: ["name"] },
      ],
    });

    if (!stocks || stocks.length === 0) {
      throw new AppError("Stock records not found", 404);
    }

    res.json(
      stocks.map((stock) => ({
        id: stock.id,
        product_id: stock.bulk_product_id,
        product_name: (stock as any).product?.name,
        unit_of_measure: (stock as any).product?.unit_of_measure,
        branch_id: stock.branch_id,
        branch_name: (stock as any).branch?.name,
        category: stock.category,
        total_area: Number(stock.total_area),
        reorder_level: Number(stock.reorder_level),
        is_low_stock: Number(stock.total_area) <= Number(stock.reorder_level),
      })),
    );
  }),
);

export default router;
