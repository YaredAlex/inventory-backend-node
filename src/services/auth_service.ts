import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Sequelize } from "sequelize";
import { User, UserRole } from "../models/user.js";
import { settings } from "../config.js";
import { EmailService } from "./email_service.js";
import logger from "./logger.js";
import crypto from "crypto";

// In-memory storage for OTPs and reset tokens (use Redis in production)
interface OTPData {
  otp: string;
  expires_at: Date;
  attempts: number;
  last_request_at?: Date;
}

interface ResetTokenData {
  email: string;
  expires_at: Date;
}

const otpStorage: Map<string, OTPData> = new Map();
const passwordResetTokens: Map<string, ResetTokenData> = new Map();

export class AuthService {
  /**
   * Verify a plain password against a hashed password
   * Supports both bcrypt and fallback methods
   */
  static async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      // Truncate password to 72 bytes if needed (bcrypt limitation)
      let pwd = plainPassword;
      if (Buffer.byteLength(pwd, "utf8") > 72) {
        pwd = pwd.slice(0, 72);
      }

      // Try bcrypt verification
      return await bcrypt.compare(pwd, hashedPassword);
    } catch (error) {
      logger.error(`❌ Password verification failed: ${error}`);

      // Fallback: try direct comparison (for legacy passwords)
      try {
        // This is a fallback - in production, you should migrate old passwords
        return false;
      } catch (fallbackError) {
        logger.error(`❌ Fallback verification also failed: ${fallbackError}`);
        return false;
      }
    }
  }

  /**
   * Hash a password using bcrypt
   */
  static async getPasswordHash(password: string): Promise<string> {
    try {
      // Truncate password to 72 bytes if needed
      let pwd = password;
      if (Buffer.byteLength(pwd, "utf8") > 72) {
        pwd = pwd.slice(0, 72);
      }

      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(pwd, salt);
    } catch (error) {
      logger.error(`❌ Password hash failed: ${error}`);
      throw new Error("Failed to hash password");
    }
  }

  /**
   * Create JWT access token
   */
  static createAccessToken(
    data: Record<string, any>,
    expiresDelta?: number,
  ): string {
    const toEncode = { ...data };

    if (expiresDelta) {
      toEncode.exp = Math.floor(Date.now() / 1000) + expiresDelta;
    } else {
      toEncode.exp =
        Math.floor(Date.now() / 1000) +
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60;
    }

    return jwt.sign(toEncode, settings.SECRET_KEY, { algorithm: "HS256" });
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(
    sequelize: Sequelize,
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    if (!user.active) {
      return null;
    }

    return user;
  }

  /**
   * Get current user from JWT token
   */
  static async getCurrentUser(
    sequelize: Sequelize,
    token: string,
  ): Promise<User | null> {
    try {
      const payload = jwt.verify(token, settings.SECRET_KEY) as any;
      const userId = payload.user_id || payload.userId;

      if (!userId) {
        return null;
      }

      const user = await User.findByPk(userId);

      if (!user || !user.active) {
        return null;
      }

      return user;
    } catch (error) {
      logger.error("❌ JWT decode error:", error);
      return null;
    }
  }

  // ==================== PASSWORD RESET METHODS ====================

  /**
   * Generate a 6-digit OTP
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a secure reset token
   */
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Check if the email belongs to an admin user
   */
  static async isAdminEmail(
    sequelize: Sequelize,
    email: string,
  ): Promise<boolean> {
    const user = await User.findOne({
      where: {
        email,
        role: UserRole.ADMIN,
        active: true,
      },
    });
    return user !== null;
  }

  /**
   * Get all active admin email addresses from database
   */
  static async getAllAdminEmails(sequelize: Sequelize): Promise<string[]> {
    const adminUsers = await User.findAll({
      where: {
        role: UserRole.ADMIN,
        active: true,
      },
      attributes: ["email"],
    });

    const emails = adminUsers.map((user) => user.email);
    logger.info(`🔍 [AUTH] Found admin emails: ${emails}`);
    return emails;
  }

  /**
   * Send OTP to email using Brevo/SMTP
   */
  static async sendOTPEmail(email: string, otp: string): Promise<boolean> {
    logger.info(`📧 Sending OTP to ${email}: ${otp}`);

    const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset OTP</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #f4f4f4;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: white;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #2FB8A6 0%, #259e8e 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 24px;
                    }
                    .content {
                        padding: 40px 30px;
                        text-align: center;
                    }
                    .otp-code {
                        background: #f0f8ff;
                        padding: 20px;
                        font-size: 36px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        color: #2FB8A6;
                        border-radius: 8px;
                        margin: 20px 0;
                        font-family: monospace;
                    }
                    .message {
                        color: #666;
                        line-height: 1.6;
                        margin: 20px 0;
                    }
                    .warning {
                        background: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 20px 0;
                        text-align: left;
                        font-size: 14px;
                        color: #856404;
                    }
                    .footer {
                        background: #f8f9fa;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #999;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p class="message">Hello,</p>
                        <p class="message">You requested to reset your password. Use the following OTP code:</p>
                        <div class="otp-code">${otp}</div>
                        <p class="message">This code is valid for <strong>10 minutes</strong>.</p>
                        <div class="warning">
                            ⚠️ If you didn't request this, please ignore this email.
                        </div>
                    </div>
                    <div class="footer">
                        <p>Inventory System - Secure Password Recovery</p>
                        <p>&copy; 2024 Inventory System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    return await EmailService.sendEmail({
      toEmails: [email],
      subject: "Password Reset OTP - Inventory System",
      templateName: "password_reset_otp.html",
      context: { otp },
    });
  }

  /**
   * Request password reset - sends OTP to admin email
   */
  static async requestPasswordReset(
    sequelize: Sequelize,
    email: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const isAdmin = await this.isAdminEmail(sequelize, email);

    if (!isAdmin) {
      return {
        success: false,
        message: "Email not found or not authorized for password reset",
      };
    }

    const otp = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    otpStorage.set(email, {
      otp,
      expires_at: expiresAt,
      attempts: 0,
    });

    await this.sendOTPEmail(email, otp);

    return {
      success: true,
      message: "OTP has been sent to your email address",
    };
  }

  /**
   * Verify OTP and return reset token
   */
  static async verifyOTP(
    sequelize: Sequelize,
    email: string,
    otp: string,
  ): Promise<{
    success: boolean;
    message: string;
    resetToken?: string;
  }> {
    const storedData = otpStorage.get(email);

    if (!storedData) {
      return {
        success: false,
        message: "No OTP request found for this email",
      };
    }

    const now = new Date();
    if (now > storedData.expires_at) {
      otpStorage.delete(email);
      return {
        success: false,
        message: "OTP has expired. Please request a new one.",
      };
    }

    if (storedData.attempts >= 5) {
      otpStorage.delete(email);
      return {
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      };
    }

    if (storedData.otp !== otp) {
      storedData.attempts++;
      const remainingAttempts = 5 - storedData.attempts;
      return {
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
      };
    }

    const resetToken = this.generateResetToken();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    passwordResetTokens.set(resetToken, {
      email,
      expires_at: expiresAt,
    });

    otpStorage.delete(email);

    return {
      success: true,
      message: "OTP verified successfully",
      resetToken,
    };
  }

  /**
   * Resend OTP to email
   */
  static async resendOTP(
    sequelize: Sequelize,
    email: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const isAdmin = await this.isAdminEmail(sequelize, email);

    if (!isAdmin) {
      return {
        success: false,
        message: "Email not found or not authorized",
      };
    }

    const existingData = otpStorage.get(email);
    if (existingData?.last_request_at) {
      const now = new Date();
      const timeSinceLast =
        now.getTime() - existingData.last_request_at.getTime();
      if (timeSinceLast < 60000) {
        // 60 seconds
        const remaining = Math.ceil((60000 - timeSinceLast) / 1000);
        return {
          success: false,
          message: `Please wait ${remaining} seconds before requesting another OTP`,
        };
      }
    }

    const otp = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    otpStorage.set(email, {
      otp,
      expires_at: expiresAt,
      attempts: 0,
      last_request_at: new Date(),
    });

    await this.sendOTPEmail(email, otp);

    return {
      success: true,
      message: "New OTP has been sent to your email address",
    };
  }

  /**
   * Reset password using valid reset token
   */
  static async resetPassword(
    sequelize: Sequelize,
    email: string,
    resetToken: string,
    newPassword: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const tokenData = passwordResetTokens.get(resetToken);

    if (!tokenData) {
      return {
        success: false,
        message: "Invalid or expired reset token",
      };
    }

    const now = new Date();
    if (now > tokenData.expires_at) {
      passwordResetTokens.delete(resetToken);
      return {
        success: false,
        message: "Reset token has expired. Please request a new OTP.",
      };
    }

    if (tokenData.email !== email) {
      return {
        success: false,
        message: "Email mismatch",
      };
    }

    const user = await User.findOne({
      where: {
        email,
        role: UserRole.ADMIN,
      },
    });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters long",
      };
    }

    user.password_hash = await this.getPasswordHash(newPassword);
    await user.save();

    passwordResetTokens.delete(resetToken);
    otpStorage.delete(email);

    return {
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    };
  }

  /**
   * Cleanup expired OTPs and reset tokens
   * Call this periodically (e.g., every hour)
   */
  static cleanupExpiredTokens(): void {
    const now = new Date();

    // Cleanup OTPs
    for (const [email, data] of otpStorage.entries()) {
      if (data.expires_at < now) {
        otpStorage.delete(email);
      }
    }

    // Cleanup reset tokens
    for (const [token, data] of passwordResetTokens.entries()) {
      if (data.expires_at < now) {
        passwordResetTokens.delete(token);
      }
    }

    logger.info("🧹 Cleaned up expired OTPs and reset tokens");
  }
}

// Run cleanup every hour
setInterval(
  () => {
    AuthService.cleanupExpiredTokens();
  },
  60 * 60 * 1000,
); // 1 hour
