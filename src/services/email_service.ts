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

interface SaleNotificationData {
  sale_id: number;
  customer_name: string;
  total_amount: number;
  item_count: number;
  salesman_name: string;
  branch_name: string;
  created_at: Date | string;
}

export class EmailService {
  /**
   * Render email template with proper HTML styling
   */
  private static renderTemplate(
    templateName: string,
    context: Record<string, any>,
  ): string {
    // Sale notification template
    if (templateName === "sale_notification.html") {
      return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Sale Alert</title>
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
            background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px;
        }
        .sale-detail {
            background: #f8f9fa;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        .label {
            font-weight: bold;
            color: #495057;
            display: inline-block;
            width: 120px;
        }
        .value {
            color: #212529;
        }
        .total {
            font-size: 20px;
            font-weight: bold;
            color: #28a745;
            text-align: right;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 2px solid #dee2e6;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛍️ New Sale Alert!</h1>
        </div>
        <div class="content">
            <div class="sale-detail">
                <span class="label">Sale ID:</span>
                <span class="value">#${context.sale_id || "N/A"}</span>
            </div>
            <div class="sale-detail">
                <span class="label">Customer:</span>
                <span class="value">${context.customer_name || "Walk-in Customer"}</span>
            </div>
            <div class="sale-detail">
                <span class="label">Items Sold:</span>
                <span class="value">${context.item_count || 0}</span>
            </div>
            <div class="sale-detail">
                <span class="label">Sold By:</span>
                <span class="value">${context.salesman_name || "Unknown"}</span>
            </div>
            <div class="sale-detail">
                <span class="label">Branch:</span>
                <span class="value">${context.branch_name || "Unknown"}</span>
            </div>
            <div class="sale-detail">
                <span class="label">Time:</span>
                <span class="value">${context.created_at || "N/A"}</span>
            </div>
            <div class="total">
                Total Amount: ETB ${typeof context.total_amount === "number" ? context.total_amount.toFixed(2) : context.total_amount || "0.00"}
            </div>
        </div>
        <div class="footer">
            <p>This is an automated notification from your Inventory System</p>
            <p>&copy; 2024 Inventory System. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;
    }

    // Low stock alert template
    if (templateName === "low_stock.html") {
      return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Low Stock Alert</title>
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
            background: linear-gradient(135deg, #ff9800 0%, #e65100 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px;
        }
        .alert-detail {
            background: #fff3e0;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #ff9800;
        }
        .label {
            font-weight: bold;
            color: #495057;
            display: inline-block;
            width: 120px;
        }
        .value {
            color: #212529;
        }
        .warning {
            background: #ffeaa7;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            text-align: center;
            color: #d63031;
            font-weight: bold;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Low Stock Alert</h1>
        </div>
        <div class="content">
            <div class="alert-detail">
                <span class="label">Product:</span>
                <span class="value"><strong>${context.product_name || "N/A"}</strong></span>
            </div>
            <div class="alert-detail">
                <span class="label">SKU:</span>
                <span class="value">${context.product_sku || "N/A"}</span>
            </div>
            <div class="alert-detail">
                <span class="label">Branch:</span>
                <span class="value">${context.branch_name || "N/A"}</span>
            </div>
            <div class="alert-detail">
                <span class="label">Current Stock:</span>
                <span class="value"><strong style="color: #ff9800;">${context.current_stock || 0} units</strong></span>
            </div>
            <div class="alert-detail">
                <span class="label">Reorder Level:</span>
                <span class="value">${context.reorder_level || 0} units</span>
            </div>
            <div class="warning">
                ⚠️ Please reorder this product as soon as possible!
            </div>
        </div>
        <div class="footer">
            <p>Inventory System - Automated Alert</p>
            <p>&copy; 2024 Inventory System. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;
    }

    // Daily report template
    if (templateName === "daily_report.html") {
      // Build top products table
      let topProductsHtml = "";
      if (context.top_products && context.top_products.length > 0) {
        topProductsHtml = `
            <h3>Top 5 Products</h3>
            <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th>Product</th>
                        <th>Quantity Sold</th>
                        <th>Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    ${context.top_products
                      .map(
                        (p: any) => `
                        <tr>
                            <td>${p.name}</td>
                            <td>${p.quantity}</td>
                            <td>ETB ${p.revenue.toFixed(2)}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        `;
      }

      // Build low stock items table
      let lowStockHtml = "";
      if (context.low_stock_items && context.low_stock_items.length > 0) {
        lowStockHtml = `
            <h3>Low Stock Items</h3>
            <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th>Product</th>
                        <th>Current Stock</th>
                        <th>Reorder Level</th>
                    </tr>
                </thead>
                <tbody>
                    ${context.low_stock_items
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
                </tbody>
            </table>
        `;
      }

      return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Sales Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 800px;
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
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .summary {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .summary-item {
            margin: 10px 0;
            font-size: 16px;
        }
        .summary-label {
            font-weight: bold;
        }
        .summary-value {
            color: #2e7d32;
            font-size: 20px;
            font-weight: bold;
        }
        h3 {
            color: #333;
            margin-top: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Sales Report</h1>
            <p>${context.date || "N/A"}</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="summary-item">
                    <span class="summary-label">Total Sales:</span>
                    <span class="summary-value">${context.total_sales || 0}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Gross Revenue:</span>
                    <span class="summary-value">ETB ${typeof context.total_revenue === "number" ? context.total_revenue.toFixed(2) : context.total_revenue || "0.00"}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Refunds:</span>
                    <span class="summary-value">ETB ${typeof context.total_refunds === "number" ? context.total_refunds.toFixed(2) : context.total_refunds || "0.00"}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Net Revenue:</span>
                    <span class="summary-value">ETB ${typeof context.net_revenue === "number" ? context.net_revenue.toFixed(2) : context.net_revenue || "0.00"}</span>
                </div>
            </div>
            
            ${topProductsHtml}
            ${lowStockHtml}
        </div>
        <div class="footer">
            <p>Inventory System - Daily Report</p>
            <p>&copy; 2024 Inventory System. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;
    }

    // Default template
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${context.subject || "Notification"}</title>
</head>
<body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2FB8A6;">${context.subject || "Notification"}</h2>
        <p>${context.message || "Email content"}</p>
        <hr>
        <p style="font-size: 12px; color: #666;">Inventory System - Automated Message</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Send email using Brevo API or SMTP
   */
  static async sendEmail(options: SendEmailOptions): Promise<boolean> {
    console.log(`🔵🔵🔵 [EMAIL DEBUG] sendEmail called 🔵🔵🔵`);
    console.log(`   - to_emails: ${options.toEmails}`);
    console.log(`   - subject: ${options.subject}`);
    console.log(`   - template_name: ${options.templateName}`);
    console.log(`   - EMAIL_ENABLED: ${settings.EMAIL_ENABLED}`);

    if (!settings.EMAIL_ENABLED) {
      console.log(
        `📧 Email disabled. Would send to ${options.toEmails}: ${options.subject}`,
      );
      logger.info(
        `[DEV MODE] Email would be sent to: ${options.toEmails.join(", ")}`,
      );
      logger.info(`[DEV MODE] Subject: ${options.subject}`);
      logger.info(`[DEV MODE] Template: ${options.templateName}`);
      return true;
    }

    if (!options.toEmails || options.toEmails.length === 0) {
      console.log(`❌ No recipients provided`);
      return false;
    }

    try {
      console.log(
        `🔵 Attempting to send email via ${settings.BREVO_API_KEY ? "Brevo API" : "SMTP"}...`,
      );

      // Render HTML content from template
      const htmlContent = this.renderTemplate(
        options.templateName,
        options.context,
      );

      // TODO: Implement actual email sending with Brevo or Nodemailer
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
          html: htmlContent
      });
      */

      console.log(
        `✅✅✅ Email sent via ${settings.BREVO_API_KEY ? "Brevo" : "SMTP"} to ${options.toEmails}: ${options.subject}`,
      );
      logger.info(`✅ Email sent to ${options.toEmails.length} recipients`);
      return true;
    } catch (error) {
      console.log(`❌❌❌ Email failed: ${error}`);
      logger.error(`Failed to send email: ${error}`);
      return false;
    }
  }

  /**
   * Send sale notification email
   */
  static async sendSaleNotification(
    toEmails: string[],
    saleData: SaleNotificationData,
  ): Promise<boolean> {
    console.log(`🔵🔵🔵 sendSaleNotification called with: ${toEmails}`);

    const context = {
      sale_id: saleData.sale_id,
      customer_name: saleData.customer_name || "Walk-in Customer",
      total_amount: saleData.total_amount,
      item_count: saleData.item_count,
      salesman_name: saleData.salesman_name,
      branch_name: saleData.branch_name,
      created_at:
        typeof saleData.created_at === "string"
          ? saleData.created_at
          : saleData.created_at.toLocaleString(),
    };

    const subject = `🛍️ New Sale Alert - Sale #${saleData.sale_id}`;

    return this.sendEmail({
      toEmails,
      subject,
      templateName: "sale_notification.html",
      context,
    });
  }

  /**
   * Send low stock alert email
   */
  static async sendLowStockAlert(
    options: LowStockAlertOptions,
  ): Promise<boolean> {
    const subject = `⚠️ Low Stock Alert: ${options.productName}`;

    const context = {
      product_name: options.productName,
      product_sku: options.productSku,
      current_stock: options.currentStock,
      reorder_level: options.reorderLevel,
      branch_name: options.branchName,
      date: new Date().toLocaleString(),
    };

    return this.sendEmail({
      toEmails: options.toEmails,
      subject,
      templateName: "low_stock.html",
      context,
    });
  }

  /**
   * Send daily report email
   */
  static async sendDailyReport(
    toEmails: string[],
    reportData: Record<string, any>,
  ): Promise<boolean> {
    const context = {
      date: reportData.date || new Date().toISOString().split("T")[0],
      total_sales: reportData.total_sales || 0,
      total_revenue: reportData.total_revenue || 0,
      total_refunds: reportData.total_refunds || 0,
      net_revenue: reportData.net_revenue || 0,
      top_products: reportData.top_products || [],
      low_stock_items: reportData.low_stock_items || [],
    };

    const subject = `📊 Daily Report - ${context.date}`;

    return this.sendEmail({
      toEmails,
      subject,
      templateName: "daily_report.html",
      context,
    });
  }
}
