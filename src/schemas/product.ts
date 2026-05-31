// Product schemas for validation
export interface ProductBase {
  sku: string;
  name: string;
  description?: string | null;
  color?: string | null;
  size?: string | null;
  pages?: number | null;
  price: number;
  cost: number;
  active: boolean;
}

export interface ProductCreate extends ProductBase {}

export interface ProductUpdate {
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

export interface ProductResponse extends ProductBase {
  id: number;
  created_at: Date;
  stock_quantity?: number;
  reorder_level?: number;
}

// Validation functions
export function validateProductCreate(data: any): ProductCreate {
  if (!data.sku || data.sku.length < 1 || data.sku.length > 100) {
    throw new Error("SKU must be between 1 and 100 characters");
  }
  if (!data.name || data.name.length < 1 || data.name.length > 255) {
    throw new Error("Name must be between 1 and 255 characters");
  }
  if (data.color && data.color.length > 50) {
    throw new Error("Color must be at most 50 characters");
  }
  if (data.size && data.size.length > 50) {
    throw new Error("Size must be at most 50 characters");
  }
  if (data.pages !== undefined && data.pages !== null && data.pages < 0) {
    throw new Error("Pages must be greater than or equal to 0");
  }
  if (data.price !== undefined && data.price <= 0) {
    throw new Error("Price must be greater than 0");
  }
  if (data.cost !== undefined && data.cost <= 0) {
    throw new Error("Cost must be greater than 0");
  }

  return {
    sku: data.sku,
    name: data.name,
    description: data.description || null,
    color: data.color || null,
    size: data.size || null,
    pages: data.pages || null,
    price: data.price,
    cost: data.cost,
    active: data.active !== undefined ? data.active : true,
  };
}

export function validateProductUpdate(data: any): ProductUpdate {
  const update: ProductUpdate = {};

  if (data.sku !== undefined) {
    if (data.sku.length < 1 || data.sku.length > 100) {
      throw new Error("SKU must be between 1 and 100 characters");
    }
    update.sku = data.sku;
  }
  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 255) {
      throw new Error("Name must be between 1 and 255 characters");
    }
    update.name = data.name;
  }
  if (data.description !== undefined) update.description = data.description;
  if (data.color !== undefined) {
    if (data.color && data.color.length > 50) {
      throw new Error("Color must be at most 50 characters");
    }
    update.color = data.color;
  }
  if (data.size !== undefined) {
    if (data.size && data.size.length > 50) {
      throw new Error("Size must be at most 50 characters");
    }
    update.size = data.size;
  }
  if (data.pages !== undefined) {
    if (data.pages !== null && data.pages < 0) {
      throw new Error("Pages must be greater than or equal to 0");
    }
    update.pages = data.pages;
  }
  if (data.price !== undefined) {
    if (data.price <= 0) {
      throw new Error("Price must be greater than 0");
    }
    update.price = data.price;
  }
  if (data.cost !== undefined) {
    if (data.cost <= 0) {
      throw new Error("Cost must be greater than 0");
    }
    update.cost = data.cost;
  }
  if (data.active !== undefined) update.active = data.active;

  return update;
}
