// Bulk product schemas for validation
export interface BulkProductBase {
  name: string;
  description?: string | null;
  unit_of_measure: string;
  buying_price: number;
  price: number;
  category_options: string[];
  active: boolean;
}

export interface BulkProductCreate extends BulkProductBase {}

export interface BulkProductUpdate {
  name?: string;
  description?: string | null;
  unit_of_measure?: string;
  buying_price?: number;
  price?: number;
  category_options?: string[];
  active?: boolean;
}

export interface BulkProductResponse extends BulkProductBase {
  id: number;
  created_at: Date;
  updated_at: Date;
  total_stock_area?: number;
  stock_by_category?: Record<string, number>;
  reorder_level?: number;
}

export interface BulkStockResponse {
  id: number;
  branch_id: number;
  branch_name?: string;
  bulk_product_id: number;
  product_name?: string;
  category: string | null;
  total_area: number;
  reorder_level: number;
  is_low_stock: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BulkStockMovementResponse {
  id: number;
  bulk_stock_id: number;
  quantity: number;
  type: "purchase" | "sale" | "return" | "adjustment";
  reference_id: number | null;
  reference_type: string | null;
  notes: string | null;
  created_at: Date;
}

// Validation functions
export function validateBulkProductCreate(data: any): BulkProductCreate {
  if (!data.name || data.name.length < 2 || data.name.length > 255) {
    throw new Error("Name must be between 2 and 255 characters");
  }

  if (
    data.description !== undefined &&
    data.description !== null &&
    typeof data.description !== "string"
  ) {
    throw new Error("Description must be a string");
  }

  const validUnits = ["m²", "ft²", "cm²"];
  const unit = data.unit_of_measure || "m²";
  if (!validUnits.includes(unit)) {
    throw new Error(`Unit of measure must be one of: ${validUnits.join(", ")}`);
  }

  if (data.buying_price === undefined || data.buying_price === null) {
    throw new Error("Buying price is required");
  }
  if (typeof data.buying_price !== "number" || data.buying_price <= 0) {
    throw new Error("Buying price must be greater than 0");
  }

  if (data.price === undefined || data.price === null) {
    throw new Error("Selling price is required");
  }
  if (typeof data.price !== "number" || data.price <= 0) {
    throw new Error("Selling price must be greater than 0");
  }

  if (data.category_options !== undefined) {
    if (!Array.isArray(data.category_options)) {
      throw new Error("Category options must be an array");
    }
    for (const category of data.category_options) {
      if (typeof category !== "string") {
        throw new Error("Each category option must be a string");
      }
    }
  }

  return {
    name: data.name,
    description: data.description || null,
    unit_of_measure: unit,
    buying_price: data.buying_price,
    price: data.price,
    category_options: data.category_options || [],
    active: data.active !== undefined ? data.active : true,
  };
}

export function validateBulkProductUpdate(data: any): BulkProductUpdate {
  const update: BulkProductUpdate = {};

  if (data.name !== undefined) {
    if (data.name.length < 2 || data.name.length > 255) {
      throw new Error("Name must be between 2 and 255 characters");
    }
    update.name = data.name;
  }

  if (data.description !== undefined) {
    if (data.description !== null && typeof data.description !== "string") {
      throw new Error("Description must be a string");
    }
    update.description = data.description;
  }

  if (data.unit_of_measure !== undefined) {
    const validUnits = ["m²", "ft²", "cm²"];
    if (!validUnits.includes(data.unit_of_measure)) {
      throw new Error(
        `Unit of measure must be one of: ${validUnits.join(", ")}`,
      );
    }
    update.unit_of_measure = data.unit_of_measure;
  }

  if (data.buying_price !== undefined) {
    if (typeof data.buying_price !== "number" || data.buying_price <= 0) {
      throw new Error("Buying price must be greater than 0");
    }
    update.buying_price = data.buying_price;
  }

  if (data.price !== undefined) {
    if (typeof data.price !== "number" || data.price <= 0) {
      throw new Error("Selling price must be greater than 0");
    }
    update.price = data.price;
  }

  if (data.category_options !== undefined) {
    if (!Array.isArray(data.category_options)) {
      throw new Error("Category options must be an array");
    }
    for (const category of data.category_options) {
      if (typeof category !== "string") {
        throw new Error("Each category option must be a string");
      }
    }
    update.category_options = data.category_options;
  }

  if (data.active !== undefined) {
    if (typeof data.active !== "boolean") {
      throw new Error("Active must be a boolean");
    }
    update.active = data.active;
  }

  return update;
}
