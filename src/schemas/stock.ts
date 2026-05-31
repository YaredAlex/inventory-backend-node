// Stock Schemas
export interface StockResponse {
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  stock_with_vat: number;
  stock_without_vat: number;
  reorder_level: number;
  status: string; // "normal", "low", "out_of_stock"
}

export interface AddStockResponse {
  success: boolean;
  message: string;
  product_id: number;
  product_name: string;
  branch_id: number;
  branch_name: string;
  old_quantity: number;
  new_quantity: number;
  old_quantity_with_vat: number;
  new_quantity_with_vat: number;
  old_quantity_without_vat: number;
  new_quantity_without_vat: number;
  added_by: string;
  role: string;
  with_vat: boolean;
}

export interface AdjustStockResponse {
  success: boolean;
  message: string;
  product_id: number;
  product_name: string;
  branch_id: number;
  branch_name: string;
  old_quantity: number;
  new_quantity: number;
  change: number;
  reason?: string | null;
  adjusted_by: string;
  role: string;
}

export interface StockMovementResponse {
  id: number;
  branch_id: number;
  product_id: number;
  user_id: number | null;
  user_name?: string | null;
  quantity_change: number;
  type: string;
  with_vat: boolean;
  reason?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export function getStockStatus(quantity: number, reorderLevel: number): string {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= reorderLevel) return "low";
  return "normal";
}
