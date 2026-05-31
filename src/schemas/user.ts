// User schemas for validation
export interface UserBase {
  name: string;
  email: string;
  role: string;
  branch_id: number | null;
  active: boolean;
}

export interface UserCreate extends UserBase {
  password: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: string;
  branch_id?: number | null;
  active?: boolean;
  password?: string;
}

export interface UserProfileUpdate {
  name?: string;
  email?: string;
  password?: string;
}

export interface UserResponse extends UserBase {
  id: number;
  created_at: Date;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// Validation functions
export function validateUserCreate(data: any): UserCreate {
  if (!data.name || data.name.length < 1 || data.name.length > 255) {
    throw new Error("Name must be between 1 and 255 characters");
  }
  if (!data.email) {
    throw new Error("Email is required");
  }
  if (
    !data.role ||
    !["admin", "salesman", "privileged_sales"].includes(data.role)
  ) {
    throw new Error("Role must be admin, salesman, or privileged_sales");
  }
  if (!data.password || data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  return {
    name: data.name,
    email: data.email,
    role: data.role,
    branch_id: data.branch_id || null,
    active: data.active !== undefined ? data.active : true,
    password: data.password,
  };
}

export function validateUserUpdate(data: any): UserUpdate {
  const update: UserUpdate = {};

  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 255) {
      throw new Error("Name must be between 1 and 255 characters");
    }
    update.name = data.name;
  }
  if (data.email !== undefined) {
    update.email = data.email;
  }
  if (data.role !== undefined) {
    if (!["admin", "salesman", "privileged_sales"].includes(data.role)) {
      throw new Error("Role must be admin, salesman, or privileged_sales");
    }
    update.role = data.role;
  }
  if (data.branch_id !== undefined) {
    update.branch_id = data.branch_id;
  }
  if (data.active !== undefined) {
    update.active = data.active;
  }
  if (data.password !== undefined) {
    if (data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    update.password = data.password;
  }

  return update;
}

export function validateUserProfileUpdate(data: any): UserProfileUpdate {
  const update: UserProfileUpdate = {};

  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 255) {
      throw new Error("Name must be between 1 and 255 characters");
    }
    update.name = data.name;
  }
  if (data.email !== undefined) {
    update.email = data.email;
  }
  if (data.password !== undefined) {
    if (data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    update.password = data.password;
  }

  return update;
}

export function validateChangePassword(data: any): ChangePasswordRequest {
  if (!data.current_password) {
    throw new Error("Current password is required");
  }
  if (!data.new_password) {
    throw new Error("New password is required");
  }
  if (data.new_password.length < 6) {
    throw new Error("New password must be at least 6 characters");
  }

  return {
    current_password: data.current_password,
    new_password: data.new_password,
  };
}
