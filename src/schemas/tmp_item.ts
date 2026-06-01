// Temp Item Status Enum
export enum TempItemStatus {
  PENDING = "pending",
  RECEIVED = "received",
  CANCELLED = "cancelled",
}

// Temp Item Base Schema
export interface TempItemBase {
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
}

// Temp Item Create Schema
export interface TempItemCreate extends TempItemBase {}

// Temp Item Update Schema
export interface TempItemUpdate {
  status?: TempItemStatus;
  notes?: string | null;
}

// Temp Item Response Schema
export interface TempItemResponse extends TempItemBase {
  id: number;
  item_number: string;
  status: TempItemStatus;
  registered_by: string;
  registered_at: Date;
  received_by?: string | null;
  received_at?: Date | null;
}

// Helper function to generate item number
export function generateItemNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TMP-${dateStr}-${random}`;
}

// Validation functions
export function validateTempItemCreate(data: any): TempItemCreate {
  if (
    !data.item_name ||
    data.item_name.length < 1 ||
    data.item_name.length > 255
  ) {
    throw new Error("Item name must be between 1 and 255 characters");
  }
  if (
    data.quantity !== undefined &&
    (data.quantity < 1 || !Number.isInteger(data.quantity))
  ) {
    throw new Error("Quantity must be a positive integer");
  }
  if (
    data.unit_price !== undefined &&
    data.unit_price !== null &&
    data.unit_price <= 0
  ) {
    throw new Error("Unit price must be greater than 0");
  }
  if (data.customer_name && data.customer_name.length > 255) {
    throw new Error("Customer name must be at most 255 characters");
  }
  if (data.customer_phone && data.customer_phone.length > 50) {
    throw new Error("Customer phone must be at most 50 characters");
  }

  return {
    item_name: data.item_name,
    description: data.description || null,
    quantity: data.quantity || 1,
    unit_price: data.unit_price || null,
    customer_name: data.customer_name || null,
    customer_phone: data.customer_phone || null,
    notes: data.notes || null,
  };
}

export function validateTempItemUpdate(data: any): TempItemUpdate {
  const update: TempItemUpdate = {};

  if (data.status !== undefined) {
    if (!Object.values(TempItemStatus).includes(data.status)) {
      throw new Error("Invalid status value");
    }
    update.status = data.status;
  }
  if (data.notes !== undefined) {
    update.notes = data.notes;
  }

  return update;
}
