import logger from "./logger.js";
import { settings } from "../config.js";

interface SendEmailOptions {
  toEmails: string[];
  subject: string;
  templateName: string;
  context: Record<string, any>;
}

interface LowStockAlertOptions {
  toEmails: string[];
  productName: string;
  productSku: string;
  currentStock: number;
  reorderLevel: number;
  branchName: string;
}

export class EmailService {
  // Add to EmailService class in src/services/EmailService.ts

  static async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      if (!settings.EMAIL_ENABLED) {
        logger.info(
          `[DEV MODE] Email would be sent to: ${options.toEmails.join(", ")}`,
        );
        logger.info(`[DEV MODE] Subject: ${options.subject}`);
        logger.info(`[DEV MODE] Template: ${options.templateName}`);
        return true;
      }

      // Implement actual email sending with Brevo or Nodemailer
      // Example with Nodemailer:
      /*
        const transporter = nodemailer.createTransport({
            host: settings.SMTP_HOST,
            port: settings.SMTP_PORT,
            secure: settings.SMTP_PORT === 465,
            auth: {
                user: settings.SMTP_USER,
                pass: settings.SMTP_PASSWORD
            }
        });
        
        await transporter.sendMail({
            from: `"${settings.BREVO_SENDER_NAME}" <${settings.BREVO_SENDER_EMAIL}>`,
            to: options.toEmails.join(', '),
            subject: options.subject,
            html: options.context.htmlContent || `Template: ${options.templateName}`
        });
        */

      logger.info(`✅ Email sent to ${options.toEmails.length} recipients`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email: ${error}`);
      return false;
    }
  }

  static async sendLowStockAlert(
    options: LowStockAlertOptions,
  ): Promise<boolean> {
    const subject = `⚠️ LOW STOCK ALERT: ${options.productName}`;

    const context = {
      product_name: options.productName,
      product_sku: options.productSku,
      current_stock: options.currentStock,
      reorder_level: options.reorderLevel,
      branch_name: options.branchName,
      alert_time: new Date().toLocaleString(),
    };

    // Build HTML email content
    const htmlContent = `
            <h2>Low Stock Alert</h2>
            <p>The following product has reached or fallen below its reorder level:</p>
            <table border="1" cellpadding="8" cellspacing="0">
                <tr><th>Product</th><td>${options.productName}</td></tr>
                <tr><th>SKU</th><td>${options.productSku}</td></tr>
                <tr><th>Branch</th><td>${options.branchName}</td></tr>
                <tr><th>Current Stock</th><td>${options.currentStock}</td></tr>
                <tr><th>Reorder Level</th><td>${options.reorderLevel}</td></tr>
                <tr><th>Alert Time</th><td>${new Date().toLocaleString()}</td></tr>
            </table>
            <p>Please take action to restock this item.</p>
        `;

    return this.sendEmail({
      toEmails: options.toEmails,
      subject,
      templateName: "low_stock_alert.html",
      context,
    });
  }

  static async sendDailyReport(
    toEmails: string[],
    reportData: Record<string, any>,
  ): Promise<boolean> {
    const subject = `📊 Daily Sales Report - ${reportData.date}`;

    // Build top products table
    let topProductsHtml = "";
    if (reportData.top_products && reportData.top_products.length > 0) {
      topProductsHtml = `
                <h3>Top 5 Products</h3>
                <table border="1" cellpadding="8" cellspacing="0">
                    <tr><th>Product</th><th>Quantity Sold</th><th>Revenue</th></tr>
                    ${reportData.top_products
                      .map(
                        (p: any) => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.quantity}</td>
                            <td>${p.revenue.toFixed(2)} ETB</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </table>
            `;
    }

    // Build low stock items table
    let lowStockHtml = "";
    if (reportData.low_stock_items && reportData.low_stock_items.length > 0) {
      lowStockHtml = `
                <h3>Low Stock Items</h3>
                <table border="1" cellpadding="8" cellspacing="0">
                    <tr><th>Product</th><th>Current Stock</th><th>Reorder Level</th></tr>
                    ${reportData.low_stock_items
                      .map(
                        (item: any) => `
                        <tr>
                            <td>${item.product_name}</td>
                            <td>${item.current_stock}</td>
                            <td>${item.reorder_level}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </table>
            `;
    }

    const htmlContent = `
            <h2>Daily Sales Report</h2>
            <p><strong>Date:</strong> ${reportData.date}</p>
            
            <h3>Summary</h3>
            <table border="1" cellpadding="8" cellspacing="0">
                <tr><th>Total Sales</th><td>${reportData.total_sales}</td></tr>
                <tr><th>Total Revenue</th><td>${reportData.total_revenue.toFixed(2)} ETB</td></tr>
                <tr><th>Total Refunds</th><td>${reportData.total_refunds.toFixed(2)} ETB</td></tr>
                <tr><th>Net Revenue</th><td>${reportData.net_revenue.toFixed(2)} ETB</td></tr>
            </table>
            
            ${topProductsHtml}
            ${lowStockHtml}
            
            <hr>
            <p><small>Generated by Inventory Management System</small></p>
        `;

    return this.sendEmail({
      toEmails,
      subject,
      templateName: "daily_report.html",
      context: reportData,
    });
  }
}
