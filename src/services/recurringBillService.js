const pool = require("../config/database");
const { generateInvoiceNumber } = require("./numberingService");
const { generatePDF, replaceTemplateVariables } = require("./pdfService");
const path = require("path");

// Due-date offset: configurable via env, defaults to 30 days
const DUE_DATE_DAYS = parseInt(process.env.RECURRING_BILL_DUE_DAYS || "30", 10);

/**
 * Process recurring bills and generate invoices for due dates.
 * Called daily by the cron job.
 */
async function processRecurringBills() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Resolve default template: env var → first template in table.
    // No more LIKE '%Standard%' guesswork.
    const configuredTemplateId = process.env.RECURRING_BILL_TEMPLATE_ID
      ? parseInt(process.env.RECURRING_BILL_TEMPLATE_ID, 10)
      : null;

    let defaultTemplateId = configuredTemplateId;
    if (!defaultTemplateId) {
      const [[firstTemplate]] = await pool.execute(
        "SELECT id FROM invoice_templates ORDER BY id ASC LIMIT 1"
      );
      if (!firstTemplate) {
        console.error("No invoice templates found - cannot process recurring bills");
        return { processed: 0, generated: 0, invoices: [] };
      }
      defaultTemplateId = firstTemplate.id;
    }

    const [bills] = await pool.execute(
      `SELECT rb.*,
       c.name as customer_name, c.email as customer_email,
       p.name as project_name
       FROM recurring_bills rb
       LEFT JOIN customers c ON rb.customer_id = c.id
       LEFT JOIN projects p ON rb.project_id = p.id
       WHERE rb.status = 'active'
       AND rb.auto_generate = TRUE
       AND rb.next_billing_date <= ?
       AND (rb.end_date IS NULL OR rb.end_date >= ?)`,
      [today, today]
    );

    const generatedInvoices = [];

    for (const bill of bills) {
      try {
        const templateId = defaultTemplateId;

        const [[template]] = await pool.execute(
          "SELECT * FROM invoice_templates WHERE id = ?",
          [templateId]
        );

        if (!template) {
          console.error(`Template ${templateId} not found - skipping recurring bill ${bill.id}`);
          continue;
        }

        const invoiceNumber = await generateInvoiceNumber();
        const dueDateMs = Date.now() + DUE_DATE_DAYS * 24 * 60 * 60 * 1000;
        const dueDateStr = new Date(dueDateMs).toISOString().split("T")[0];

        const variables = {
          invoice_number: invoiceNumber,
          "customer.name": bill.customer_name,
          "customer.email": bill.customer_email || "",
          "invoice.total_amount": Number(bill.amount).toFixed(2),
          "invoice.final_amount": Number(bill.amount).toFixed(2),
          "invoice.tax_amount": "0.00",
          "invoice.discount_amount": "0.00",
          "invoice.currency": "LKR",
          "invoice.due_date": new Date(dueDateMs).toLocaleDateString(),
          project_name: bill.project_name || "",
          date: new Date().toLocaleDateString(),
        };

        const htmlContent = replaceTemplateVariables(template.html_content, variables);

        // Calculate next billing date
        const nextBillingDate = new Date(bill.next_billing_date);
        if (bill.frequency === "monthly") {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else if (bill.frequency === "annually") {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        }

        const [result] = await pool.execute(
          `INSERT INTO invoices (invoice_number, customer_id, project_id, template_id, subject,
           total_amount, currency, tax_amount, discount_amount, final_amount, due_date, status, html_content, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, 1)`,
          [
            invoiceNumber,
            bill.customer_id,
            bill.project_id || null,
            templateId,
            `Recurring ${bill.frequency} billing - ${bill.project_name || "Service"}`,
            bill.amount,
            "LKR",
            0,
            0,
            bill.amount,
            dueDateStr,
            htmlContent,
          ]
        );

        const invoiceId = result.insertId;

        const pdfPath = path.join(__dirname, "../../uploads/pdfs", `invoice_${invoiceId}.pdf`);
        await generatePDF(htmlContent, pdfPath);
        await pool.execute("UPDATE invoices SET pdf_path = ? WHERE id = ?", [pdfPath, invoiceId]);

        await pool.execute(
          "UPDATE recurring_bills SET next_billing_date = ? WHERE id = ?",
          [nextBillingDate.toISOString().split("T")[0], bill.id]
        );

        generatedInvoices.push({ invoice_number: invoiceNumber, customer_name: bill.customer_name, amount: bill.amount });
        console.log(`Generated invoice ${invoiceNumber} for recurring bill ${bill.id}`);
      } catch (error) {
        console.error(`Error processing recurring bill ${bill.id}:`, error);
        // Continue processing remaining bills even if one fails
      }
    }

    return {
      processed: bills.length,
      generated: generatedInvoices.length,
      invoices: generatedInvoices,
    };
  } catch (error) {
    console.error("Process recurring bills error:", error);
    throw error;
  }
}

module.exports = { processRecurringBills };
