import { Sequelize, Op } from "sequelize";
import { Stock } from "../models/stock.js";
import { Product } from "../models/product.js";
import { Branch } from "../models/branch.js";
import { User } from "../models/user.js";
import { MovementType, StockMovement } from "../models/stock_movement.js";
import { AppError } from "../middleware/error_handle.js";
import { getStockStatus } from "../schemas/stock.js";
import logger from "./logger.js";

export class StockService {
  static async getBranchStock(
    sequelize: Sequelize,
    branchId: number,
    lowStockOnly: boolean = false,
  ): Promise<any[]> {
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const stocks = await Stock.findAll({
      where: { branch_id: branchId },
      include: [{ model: Product, as: "product" }],
    });

    const result = [];
    for (const stock of stocks) {
      const product = (stock as any).product;
      if (!product) continue;

      const quantity = Number(stock.quantity);
      const reorderLevel = Number(stock.reorder_level);
      const status = getStockStatus(quantity, reorderLevel);

      if (lowStockOnly && status !== "low") continue;

      result.push({
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: quantity,
        stock_with_vat: Number(stock.quantity_with_vat) || 0,
        stock_without_vat: Number(stock.quantity_without_vat) || 0,
        reorder_level: reorderLevel,
        status: status,
      });
    }

    return result;
  }

  static async addStock(
    sequelize: Sequelize,
    branchId: number,
    productId: number,
    quantity: number,
    userId: number,
    withVat: boolean = true,
    notes?: string | null,
  ): Promise<any> {
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    let stock = await Stock.findOne({
      where: {
        branch_id: branchId,
        product_id: productId,
      },
    });

    let oldQuantity = 0;
    let oldQuantityWithVat = 0;
    let oldQuantityWithoutVat = 0;
    let newQuantity: number;
    let newQuantityWithVat: number;
    let newQuantityWithoutVat: number;

    if (stock) {
      oldQuantity = Number(stock.quantity);
      oldQuantityWithVat = Number(stock.quantity_with_vat) || 0;
      oldQuantityWithoutVat = Number(stock.quantity_without_vat) || 0;

      newQuantity = oldQuantity + quantity;

      if (withVat) {
        newQuantityWithVat = oldQuantityWithVat + quantity;
        newQuantityWithoutVat = oldQuantityWithoutVat;
      } else {
        newQuantityWithVat = oldQuantityWithVat;
        newQuantityWithoutVat = oldQuantityWithoutVat + quantity;
      }

      stock.quantity = newQuantity;
      stock.quantity_with_vat = newQuantityWithVat;
      stock.quantity_without_vat = newQuantityWithoutVat;
      await stock.save();
    } else {
      oldQuantity = 0;
      oldQuantityWithVat = 0;
      oldQuantityWithoutVat = 0;
      newQuantity = quantity;

      if (withVat) {
        newQuantityWithVat = quantity;
        newQuantityWithoutVat = 0;
      } else {
        newQuantityWithVat = 0;
        newQuantityWithoutVat = quantity;
      }

      stock = await Stock.create({
        branch_id: branchId,
        product_id: productId,
        quantity: newQuantity,
        quantity_with_vat: newQuantityWithVat,
        quantity_without_vat: newQuantityWithoutVat,
        reorder_level: 10,
      });
    }

    const user = await User.findByPk(userId);
    const vatStatus = withVat ? "with VAT" : "without VAT";

    // Record stock movement
    await StockMovement.create({
      branch_id: branchId,
      product_id: productId,
      user_id: userId,
      change_qty: quantity,
      movement_type: MovementType.ADD ,
      notes:
        notes ||
        `Stock added by ${user?.name || "Unknown"} (Role: ${user?.role || "Unknown"}) - ${vatStatus}`,
      with_vat: withVat,
    });

    logger.info(
      `Stock added: ${quantity} units of ${product.name} (${vatStatus})`,
    );

    return {
      success: true,
      message: `Added ${quantity} units of ${product.name} (${vatStatus})`,
      product_id: productId,
      product_name: product.name,
      branch_id: branchId,
      branch_name: branch.name,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      old_quantity_with_vat: oldQuantityWithVat,
      new_quantity_with_vat: newQuantityWithVat,
      old_quantity_without_vat: oldQuantityWithoutVat,
      new_quantity_without_vat: newQuantityWithoutVat,
      added_by: user?.name || "Unknown",
      role: user?.role || "Unknown",
      with_vat: withVat,
    };
  }

  static async adjustStock(
    sequelize: Sequelize,
    branchId: number,
    productId: number,
    quantity: number,
    userId: number,
    reason?: string | null,
  ): Promise<any> {
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const stock = await Stock.findOne({
      where: {
        branch_id: branchId,
        product_id: productId,
      },
    });

    if (!stock) {
      throw new AppError("Stock record not found", 404);
    }

    const oldQuantity = Number(stock.quantity);
    const quantityChange = quantity - oldQuantity;

    stock.quantity = quantity;
    await stock.save();

    const user = await User.findByPk(userId);

    let notesText = `Stock adjusted by ${user?.name || "Unknown"} (Role: ${user?.role || "Unknown"})`;
    if (reason) {
      notesText = `Reason: ${reason} | ${notesText}`;
    }

    // Record stock movement
    await StockMovement.create({
      branch_id: branchId,
      product_id: productId,
      user_id: userId,
      change_qty: quantityChange,
      movement_type: MovementType.ADJUSTMENT,
      notes: notesText,
    });

    logger.info(`Stock adjusted: ${product.name} to ${quantity} units`);

    return {
      success: true,
      message: `Adjusted ${product.name} stock to ${quantity} units`,
      product_id: productId,
      product_name: product.name,
      branch_id: branchId,
      branch_name: branch.name,
      old_quantity: oldQuantity,
      new_quantity: quantity,
      change: quantityChange,
      reason: reason || null,
      adjusted_by: user?.name || "Unknown",
      role: user?.role || "Unknown",
    };
  }

  static async initializeBranchStock(
    sequelize: Sequelize,
    branchId: number,
    userId: number,
  ): Promise<any> {
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const products = await Product.findAll({
      where: { active: true },
    });

    let createdCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const existing = await Stock.findOne({
        where: {
          branch_id: branchId,
          product_id: product.id,
        },
      });

      if (!existing) {
        await Stock.create({
          branch_id: branchId,
          product_id: product.id,
          quantity: 0,
          quantity_with_vat: 0,
          quantity_without_vat: 0,
          reorder_level: 10,
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    const user = await User.findByPk(userId);

    logger.info(
      `Stock initialized for ${createdCount} products in branch ${branch.name}`,
    );

    return {
      message: `Initialized stock for ${createdCount} products in branch ${branch.name}`,
      branch_id: branchId,
      branch_name: branch.name,
      products_initialized: createdCount,
      products_already_existing: skippedCount,
      initialized_by: user?.name || "Unknown",
      role: user?.role || "Unknown",
    };
  }

  static async getStockHistory(
    sequelize: Sequelize,
    branchId: number,
    productId: number,
    limit: number = 50,
  ): Promise<any[]> {
    const branch = await Branch.findByPk(branchId);
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const movements = await StockMovement.findAll({
      where: {
        branch_id: branchId,
        product_id: productId,
      },
      order: [["created_at", "DESC"]],
      limit,
    });

    const result = [];
    for (const movement of movements) {
      let userName = null;
      if (movement.user_id) {
        const user = await User.findByPk(movement.user_id);
        if (user) {
          userName = user.name;
        }
      }

      // Determine movement type for frontend
      let movementTypeDisplay = movement.movement_type;
      if (movementTypeDisplay === "add" || movementTypeDisplay === "purchase") {
        movementTypeDisplay = MovementType.ADD;
      } else if (movementTypeDisplay === "adjustment") {
        movementTypeDisplay = MovementType.ADJUSTMENT;
      }

      // Extract reason from notes if present
      let reason = null;
      if (movement.notes && movement.notes.includes("Reason:")) {
        const reasonMatch = movement.notes.match(/Reason:\s*(.*?)\s*\|/);
        if (reasonMatch) {
          reason = reasonMatch[1]?.trim();
        }
      }

      result.push({
        id: movement.id,
        branch_id: movement.branch_id,
        product_id: movement.product_id,
        user_id: movement.user_id,
        user_name: userName,
        quantity_change: Number(movement.change_qty),
        type: movementTypeDisplay,
        with_vat: movement.with_vat !== undefined ? movement.with_vat : true,
        reason: reason,
        notes: movement.notes,
        created_at: movement.created_at?.toISOString() || null,
      });
    }

    return result;
  }

  static async getLowStockProducts(
    sequelize: Sequelize,
    branchId: number,
  ): Promise<any[]> {
    const stocks = await Stock.findAll({
      where: {
        branch_id: branchId,
        [Op.and]: sequelize.literal(
          "quantity <= reorder_level AND quantity > 0",
        ),
      },
      include: [{ model: Product, as: "product" }],
    });

    return stocks.map((stock) => ({
      product_id: stock.product_id,
      product_name: (stock as any).product?.name || "Unknown",
      product_sku: (stock as any).product?.sku || "N/A",
      quantity: Number(stock.quantity),
      reorder_level: Number(stock.reorder_level),
      status: "low",
    }));
  }
}
