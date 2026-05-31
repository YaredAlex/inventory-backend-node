// Purchase Item Schemas
export interface PurchaseItemCreate {
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseCreate {
  branch_id: number;
  supplier_name?: string | null;
  items: PurchaseItemCreate[];
  with_vat?: boolean;
}

export interface Purchase {
  id: number;
  branch_id: number;
  supplier_name?: string | null;
  total_amount: number;
  created_at: Date;
  items: PurchaseItem[];
}

// Purchase Order Schemas
export interface PurchaseOrderItemBase {
  product_id: number;
  quantity_ordered: number;
  unit_cost: number;
  notes?: string | null;
}

export interface PurchaseOrderItemCreate extends PurchaseOrderItemBase {}

export interface PurchaseOrderItemResponse extends PurchaseOrderItemBase {
  id: number;
  quantity_received: number;
  total_cost: number;
  received_at?: Date | null;
  product_name?: string | null;
}

export interface PurchaseOrderBase {
  supplier: string;
  expected_delivery_date?: Date | null;
  vat_rate?: number | null;
  tax_amount?: number;
  shipping_cost?: number;
  discount_amount?: number;
  notes?: string | null;
  bank_account_id?: number | null;
  payment_reference?: string | null;
  payment_date?: Date | null;
}

export interface PurchaseOrderCreate extends PurchaseOrderBase {
  items: PurchaseOrderItemCreate[];
}

export interface PurchaseOrderUpdate {
  status?: string;
  actual_delivery_date?: Date | null;
  notes?: string | null;
  bank_account_id?: number | null;
  payment_reference?: string | null;
  payment_date?: Date | null;
}

export interface ReceivePurchaseItem {
  product_id: number;
  quantity_received: number;
}

export interface ReceivePurchaseOrder {
  items: ReceivePurchaseItem[];
  actual_delivery_date: Date;
}

export interface PurchaseOrderResponse extends PurchaseOrderBase {
  id: number;
  order_number: string;
  branch_id: number;
  order_date: Date;
  actual_delivery_date?: Date | null;
  status: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  items: PurchaseOrderItemResponse[];
  created_by: string;
  created_at: Date;
  updated_at?: Date | null;
  bank_account_name?: string | null;
  bank_name?: string | null;
}

// Validation functions
export function validatePurchaseCreate(data: any): PurchaseCreate {
  if (!data.branch_id) {
    throw new Error("Branch ID is required");
  }
  if (!data.items || data.items.length === 0) {
    throw new Error("At least one item is required");
  }
  for (const item of data.items) {
    if (!item.product_id) throw new Error("Product ID is required");
    if (!item.quantity || item.quantity <= 0)
      throw new Error("Quantity must be greater than 0");
    if (!item.unit_cost || item.unit_cost <= 0)
      throw new Error("Unit cost must be greater than 0");
  }

  return {
    branch_id: data.branch_id,
    supplier_name: data.supplier_name,
    items: data.items,
    with_vat: data.with_vat || false,
  };
}

export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PO-${dateStr}-${random}`;
}
