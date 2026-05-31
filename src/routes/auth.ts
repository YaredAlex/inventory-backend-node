import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth_service.js";
import { database } from "../database.js";
import { UserRole } from "../models/user.js";
import logger from "../services/logger.js";

// ==================== Request/Response Schemas ====================

interface ForgotPasswordRequest {
  email: string;
}

interface VerifyOTPRequest {
  email: string;
  otp: string;
}

interface ResendOTPRequest {
  email: string;
}

interface ResetPasswordRequest {
  email: string;
  resetToken: string;
  newPassword: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
  resetToken?: string | undefined;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  branch_id: number | null;
  active: boolean;
  created_at?: Date;
}

// ==================== Router ====================

const router = Router();

// Helper function to extract token from Authorization header
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader?.split(" ")[1] ?? null;
}

/**
 * Request password reset - sends OTP to admin email
 * POST /api/auth/forgot-password
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email }: ForgotPasswordRequest = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const result = await AuthService.requestPasswordReset(
      database.sequelize!,
      email,
    );

    const response: ForgotPasswordResponse = {
      success: result.success,
      message: result.message,
    };

    res.json(response);
  } catch (error) {
    logger.error(`Forgot password error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Verify OTP and return reset token
 * POST /api/auth/verify-otp
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp }: VerifyOTPRequest = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const result = await AuthService.verifyOTP(database.sequelize!, email, otp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    const response: VerifyOTPResponse = {
      success: result.success,
      message: result.message,
      resetToken: result.resetToken,
    };

    res.json(response);
  } catch (error) {
    logger.error(`Verify OTP error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Resend OTP to email
 * POST /api/auth/resend-otp
 */
router.post("/resend-otp", async (req: Request, res: Response) => {
  try {
    const { email }: ResendOTPRequest = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const result = await AuthService.resendOTP(database.sequelize!, email);

    const response: ForgotPasswordResponse = {
      success: result.success,
      message: result.message,
    };

    res.json(response);
  } catch (error) {
    logger.error(`Resend OTP error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Reset password using valid reset token
 * POST /api/auth/reset-password
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { email, resetToken, newPassword }: ResetPasswordRequest = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, reset token, and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const result = await AuthService.resetPassword(
      database.sequelize!,
      email,
      resetToken,
      newPassword,
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    const response: ForgotPasswordResponse = {
      success: result.success,
      message: result.message,
    };

    res.json(response);
  } catch (error) {
    logger.error(`Reset password error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * Login endpoint for both admin and salesman
 * POST /api/auth/token
 * (OAuth2 compatible - accepts form data)
 */
router.post("/token", async (req: Request, res: Response) => {
  try {
    // Support both JSON and form-urlencoded
    let username: string;
    let password: string;

    if (
      req.headers["content-type"]?.includes("application/x-www-form-urlencoded")
    ) {
      // Handle form data (OAuth2 standard)
      username = req.body.username;
      password = req.body.password;
    } else {
      // Handle JSON
      username = req.body.username || req.body.email;
      password = req.body.password;
    }

    if (!username || !password) {
      return res.status(401).json({
        detail: "Incorrect username or password",
      });
    }

    const user = await AuthService.authenticateUser(
      database.sequelize!,
      username,
      password,
    );

    if (!user) {
      return res.status(401).json({
        detail: "Incorrect username or password",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        detail: "User account is disabled",
      });
    }

    const accessToken = AuthService.createAccessToken({
      sub: user.email,
      role: user.role,
      user_id: user.id,
      branch_id: user.branch_id,
    });

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: "bearer",
    };

    res.json(response);
  } catch (error) {
    logger.error(`Login error: ${error}`);
    res.status(500).json({
      detail: "Internal server error",
    });
  }
});

/**
 * Get current logged-in user info
 * GET /api/auth/me
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        detail: "Not authenticated",
      });
    }

    const user = await AuthService.getCurrentUser(database.sequelize!, token);

    if (!user) {
      return res.status(401).json({
        detail: "Invalid authentication credentials",
      });
    }

    const response: UserResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      active: user.active,
      created_at: user.created_at,
    };

    res.json(response);
  } catch (error) {
    logger.error(`Get current user error: ${error}`);
    res.status(500).json({
      detail: "Internal server error",
    });
  }
});

/**
 * Logout endpoint (optional - client-side token removal)
 * POST /api/auth/logout
 */
router.post("/logout", async (req: Request, res: Response) => {
  try {
    // JWT is stateless, so logout is handled client-side
    // This endpoint exists for API completeness
    res.json({ message: "Successfully logged out" });
  } catch (error) {
    logger.error(`Logout error: ${error}`);
    res.status(500).json({ detail: "Internal server error" });
  }
});

/**
 * Refresh token endpoint (optional)
 * POST /api/auth/refresh
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        detail: "Not authenticated",
      });
    }

    const user = await AuthService.getCurrentUser(database.sequelize!, token);

    if (!user) {
      return res.status(401).json({
        detail: "Invalid authentication credentials",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        detail: "User account is disabled",
      });
    }

    const newAccessToken = AuthService.createAccessToken({
      sub: user.email,
      role: user.role,
      user_id: user.id,
      branch_id: user.branch_id,
    });

    res.json({
      access_token: newAccessToken,
      token_type: "bearer",
    });
  } catch (error) {
    logger.error(`Token refresh error: ${error}`);
    res.status(500).json({
      detail: "Internal server error",
    });
  }
});

export default router;
