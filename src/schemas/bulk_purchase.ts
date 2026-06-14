// Bulk purchase schemas for validation
export interface BulkPurchaseCreate {
  supplier: string;
  items: BulkPurchaseItemData[];
  expected_delivery_date?: Date | null;
  notes?: string | null;
  vat_rate?: number;
  bank_account_id?: number | null;
  payment_reference?: string | null;
  payment_date?: Date | null;
}

export interface BulkPurchaseItemData {
  bulk_product_id: number;
  selected_category?: string | null;
  total_area: number;
  buying_price: number;
  notes?: string | null;
}

export interface BulkPurchaseReceive {
  items: BulkReceiveItemData[];
  actual_delivery_date?: Date;
}

export interface BulkReceiveItemData {
  bulk_product_id: number;
  selected_category?: string | null;
  total_area_received: number;
}

export function generateBulkOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `BPO-${year}${month}${day}-${random}`;
}

export function validateBulkPurchaseCreate(data: any): BulkPurchaseCreate {
  if (!data.supplier || typeof data.supplier !== "string") {
    throw new Error("Supplier name is required");
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("At least one item is required");
  }

  for (const item of data.items) {
    if (!item.bulk_product_id || typeof item.bulk_product_id !== "number") {
      throw new Error("Product ID is required for each item");
    }
    if (
      !item.total_area ||
      typeof item.total_area !== "number" ||
      item.total_area <= 0
    ) {
      throw new Error("Total area must be greater than 0 for each item");
    }
    if (
      !item.buying_price ||
      typeof item.buying_price !== "number" ||
      item.buying_price <= 0
    ) {
      throw new Error("Buying price must be greater than 0 for each item");
    }
  }

  return {
    supplier: data.supplier,
    items: data.items,
    expected_delivery_date: data.expected_delivery_date || null,
    notes: data.notes || null,
    vat_rate: data.vat_rate || 15,
    bank_account_id: data.bank_account_id || null,
    payment_reference: data.payment_reference || null,
    payment_date: data.payment_date || null,
  };
}

export function validateBulkPurchaseReceive(data: any): BulkPurchaseReceive {
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("At least one item is required for receiving");
  }

  for (const item of data.items) {
    if (!item.bulk_product_id || typeof item.bulk_product_id !== "number") {
      throw new Error("Product ID is required for each received item");
    }
    if (
      !item.total_area_received ||
      typeof item.total_area_received !== "number" ||
      item.total_area_received <= 0
    ) {
      throw new Error("Received area must be greater than 0 for each item");
    }
  }

  return {
    items: data.items,
    actual_delivery_date: data.actual_delivery_date || new Date(),
  };
}
