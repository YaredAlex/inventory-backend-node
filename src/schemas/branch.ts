// Branch schemas for validation
export interface BranchBase {
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface BranchCreate extends BranchBase {}

export interface BranchUpdate {
  name?: string;
  address?: string | null;
  phone?: string | null;
}

export interface BranchResponse extends BranchBase {
  id: number;
  created_at: Date;
}

// Validation functions
export function validateBranchCreate(data: any): BranchCreate {
  if (!data.name || data.name.length < 1 || data.name.length > 255) {
    throw new Error("Name must be between 1 and 255 characters");
  }
  if (data.phone && data.phone.length > 50) {
    throw new Error("Phone must be at most 50 characters");
  }

  return {
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
  };
}

export function validateBranchUpdate(data: any): BranchUpdate {
  const update: BranchUpdate = {};

  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 255) {
      throw new Error("Name must be between 1 and 255 characters");
    }
    update.name = data.name;
  }
  if (data.address !== undefined) {
    update.address = data.address;
  }
  if (data.phone !== undefined) {
    if (data.phone && data.phone.length > 50) {
      throw new Error("Phone must be at most 50 characters");
    }
    update.phone = data.phone;
  }

  return update;
}
