import { Sequelize, Op } from "sequelize";
import { TempItem } from "../models/tmp_item.js";
import { User } from "../models/user.js";
import {
  TempItemStatus,
  generateItemNumber,
  TempItemCreate,
  TempItemResponse,
} from "../schemas/tmp_item.js";
import { AppError } from "../middleware/error_handle.js";
import logger from "./logger.js";

export class TempItemService {
  /**
   * Register a new temporary item
   */
  static async registerTempItem(
    sequelize: Sequelize,
    itemData: TempItemCreate,
    userId: number,
  ): Promise<any> {
    const tempItem = await TempItem.create({
      item_number: generateItemNumber(),
      item_name: itemData.item_name,
      description: itemData.description || null,
      quantity: itemData.quantity,
      unit_price: itemData.unit_price || null,
      customer_name: itemData.customer_name || null,
      customer_phone: itemData.customer_phone || null,
      notes: itemData.notes || null,
      registered_by: userId,
      status: TempItemStatus.PENDING,
    });

    const registrar = await User.findByPk(userId);

    logger.info(
      `Temp item registered: ${tempItem.item_number} by ${registrar?.name || "Unknown"}`,
    );

    return {
      id: tempItem.id,
      item_number: tempItem.item_number,
      item_name: tempItem.item_name,
      description: tempItem.description,
      quantity: tempItem.quantity,
      unit_price: tempItem.unit_price ? Number(tempItem.unit_price) : null,
      customer_name: tempItem.customer_name,
      customer_phone: tempItem.customer_phone,
      notes: tempItem.notes,
      status: tempItem.status,
      registered_by: registrar?.name || "System",
      registered_at: tempItem.registered_at,
      received_by: null,
      received_at: null,
    };
  }

  /**
   * Get temporary items with filters
   */
  static async getTempItems(
    sequelize: Sequelize,
    userId: number,
    userRole: string,
    options?: {
      status?: string;
      search?: string;
      skip?: number;
      limit?: number;
    },
  ): Promise<any[]> {
    const { status, search, skip = 0, limit = 100 } = options || {};

    const where: any = {};

    // Filter by user role
    if (userRole === "salesman") {
      where.registered_by = userId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { item_name: { [Op.like]: `%${search}%` } },
        { item_number: { [Op.like]: `%${search}%` } },
        { customer_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const items = await TempItem.findAll({
      where,
      order: [["registered_at", "DESC"]],
      offset: skip,
      limit,
    });

    const result = [];
    for (const item of items) {
      const registrar = await User.findByPk(item.registered_by);
      const receiver = item.received_by
        ? await User.findByPk(item.received_by)
        : null;

      result.push({
        id: item.id,
        item_number: item.item_number,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price ? Number(item.unit_price) : null,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        notes: item.notes,
        status: item.status,
        registered_by: registrar?.name || "System",
        registered_at: item.registered_at,
        received_by: receiver?.name || null,
        received_at: item.received_at,
      });
    }

    return result;
  }

  /**
   * Get a single temporary item by ID
   */
  static async getTempItemById(
    sequelize: Sequelize,
    itemId: number,
  ): Promise<TempItem | null> {
    return await TempItem.findByPk(itemId);
  }

  /**
   * Receive a temporary item (mark as received)
   */
  static async receiveTempItem(
    sequelize: Sequelize,
    itemId: number,
    userId: number,
  ): Promise<{ message: string; itemId: number }> {
    const item = await TempItem.findByPk(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    if (item.status === TempItemStatus.RECEIVED) {
      throw new AppError("Item already received", 400);
    }

    if (item.status === TempItemStatus.CANCELLED) {
      throw new AppError("Cannot receive a cancelled item", 400);
    }

    item.status = TempItemStatus.RECEIVED;
    item.received_by = userId;
    item.received_at = new Date();
    await item.save();

    const receiver = await User.findByPk(userId);
    logger.info(
      `Temp item received: ${item.item_number} by ${receiver?.name || "Unknown"}`,
    );

    return {
      message: "Item marked as received successfully",
      itemId: item.id,
    };
  }

  /**
   * Cancel a temporary item
   */
  static async cancelTempItem(
    sequelize: Sequelize,
    itemId: number,
    userId: number,
    userRole: string,
  ): Promise<{ message: string }> {
    const item = await TempItem.findByPk(itemId);

    if (!item) {
      throw new AppError("Item not found", 404);
    }

    // Check authorization
    if (userRole === "salesman" && item.registered_by !== userId) {
      throw new AppError("Not authorized to cancel this item", 403);
    }

    if (item.status === TempItemStatus.RECEIVED) {
      throw new AppError("Cannot cancel a received item", 400);
    }

    item.status = TempItemStatus.CANCELLED;
    await item.save();

    const user = await User.findByPk(userId);
    logger.info(
      `Temp item cancelled: ${item.item_number} by ${user?.name || "Unknown"}`,
    );

    return {
      message: "Item cancelled successfully",
    };
  }

  /**
   * Get temp items count by status
   */
  static async getTempItemsCount(
    sequelize: Sequelize,
    userId: number,
    userRole: string,
    status?: string,
  ): Promise<number> {
    const where: any = {};

    if (userRole === "salesman") {
      where.registered_by = userId;
    }

    if (status) {
      where.status = status;
    }

    return await TempItem.count({ where });
  }

  /**
   * Bulk delete old temp items (cleanup)
   */
  static async cleanupOldTempItems(
    sequelize: Sequelize,
    daysOld: number = 30,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleted = await TempItem.destroy({
      where: {
        status: TempItemStatus.CANCELLED,
        registered_at: { [Op.lte]: cutoffDate },
      },
    });

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old cancelled temp items`);
    }

    return deleted;
  }
}
