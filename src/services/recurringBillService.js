const pool = require("../config/database");
const { generateInvoiceNumber } = require("./numberingService");
const { generatePDF, replaceTemplateVariables } = require("./pdfService");
const path = require("path");

/**
 * Process recurring bills and generate invoices for due dates
 * This should be called by a cron job daily
 */
async function processRecurringBills() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all active recurring bills that are due today or overdue
    const [bills] = await pool.execute(
      `SELECT rb.*, 
       c.name as customer_name, c.email as customer_email,
       p.name as project_name,
       it.id as template_id
       FROM recurring_bills rb
       LEFT JOIN customers c ON rb.customer_id = c.id
       LEFT JOIN projects p ON rb.project_id = p.id
       LEFT JOIN invoice_templates it ON it.name LIKE '%Standard%' OR it.id = (SELECT MIN(id) FROM invoice_templates)
       WHERE rb.status = 'active' 
       AND rb.auto_generate = TRUE
       AND rb.next_billing_date <= ?
       AND (rb.end_date IS NULL OR rb.end_date >= ?)`,
      [today, today]
    );

    const generatedInvoices = [];

    for (const bill of bills) {
      try {
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber();

        // Get default invoice template
        const [templates] = await pool.execute(
          "SELECT * FROM invoice_templates WHERE id = ?",
          [bill.template_id || 1]
        );

        if (templates.length === 0) {
          console.error(`No template found for recurring bill ${bill.id}`);
          continue;
        }

        const template = templates[0];

        // Prepare variables for template
        const variables = {
          invoice_number: invoiceNumber,
          customer_name: bill.customer_name,
          customer_email: bill.customer_email,
          project_name: bill.project_name || "",
          total_amount: bill.amount.toFixed(2),
          final_amount: bill.amount.toFixed(2),
          tax_amount: "0.00",
          discount_amount: "0.00",
          date: new Date().toLocaleDateString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 30 days from now
        };

        // Replace template variables
        let htmlContent = replaceTemplateVariables(template.html_content, variables);

        // Calculate next billing date
        const nextBillingDate = new Date(bill.next_billing_date);
        if (bill.frequency === "monthly") {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else if (bill.frequency === "annually") {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        }

        // Create invoice
        const [result] = await pool.execute(
          `INSERT INTO invoices (invoice_number, customer_id, project_id, template_id, subject,
           total_amount, currency, tax_amount, discount_amount, final_amount, due_date, status, html_content, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceNumber,
            bill.customer_id,
            bill.project_id,
            bill.template_id || 1,
            `Recurring ${bill.frequency} billing - ${bill.project_name || "Service"}`,
            bill.amount,
            "LKR",
            0,
            0,
            bill.amount,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            "sent",
            htmlContent,
            1, // System user
          ]
        );

        const invoiceId = result.insertId;

        // Generate PDF
        const pdfPath = path.join(
          __dirname,
          "../../uploads/pdfs",
          `invoice_${invoiceId}.pdf`
        );
        await generatePDF(htmlContent, pdfPath);

        // Update invoice with PDF path
        await pool.execute("UPDATE invoices SET pdf_path = ? WHERE id = ?", [
          pdfPath,
          invoiceId,
        ]);

        // Update recurring bill next billing date
        await pool.execute(
          "UPDATE recurring_bills SET next_billing_date = ? WHERE id = ?",
          [nextBillingDate.toISOString().split("T")[0], bill.id]
        );

        generatedInvoices.push({
          invoice_number: invoiceNumber,
          customer_name: bill.customer_name,
          amount: bill.amount,
        });

        console.log(
          `Generated invoice ${invoiceNumber} for recurring bill ${bill.id}`
        );
      } catch (error) {
        console.error(`Error processing recurring bill ${bill.id}:`, error);
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

module.exports = {
  processRecurringBills,
};

