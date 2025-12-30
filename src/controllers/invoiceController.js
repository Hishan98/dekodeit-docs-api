const pool = require('../config/database');
const Joi = require('joi');
const { generateInvoiceNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const path = require('path');

const invoiceSchema = Joi.object({
  customer_id: Joi.number().integer().required(),
  project_id: Joi.number().integer().allow(null),
  proposal_id: Joi.number().integer().allow(null),
  template_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  total_amount: Joi.number().positive().required(),
  currency: Joi.string().default('LKR'),
  tax_amount: Joi.number().min(0).default(0),
  discount_amount: Joi.number().min(0).default(0),
  due_date: Joi.date().allow(null),
  status: Joi.string().valid('draft', 'sent', 'paid', 'overdue', 'cancelled').default('draft'),
  notes: Joi.string().allow('', null),
  line_items: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().positive().default(1),
      unit_price: Joi.number().positive().required(),
    })
  ).optional(),
});

const getInvoices = async (req, res) => {
  try {
    const [invoices] = await pool.execute(
      `SELECT i.*, c.name as customer_name, c.email as customer_email,
       it.name as template_name, p.name as project_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN invoice_templates it ON i.template_id = it.id
       LEFT JOIN projects p ON i.project_id = p.id
       ORDER BY i.created_at DESC`
    );
    res.json({ invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoices] = await pool.execute(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
       c.company as customer_company, c.address as customer_address, c.vat_id as customer_vat_id,
       it.name as template_name, p.name as project_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN invoice_templates it ON i.template_id = it.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get line items
    const [lineItems] = await pool.execute(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ?',
      [id]
    );

    // Get payments
    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC',
      [id]
    );

    res.json({
      invoice: invoices[0],
      line_items: lineItems,
      payments: payments,
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createInvoice = async (req, res) => {
  try {
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Get template
    const [templates] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [value.template_id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get customer
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [value.customer_id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customers[0];
    const template = templates[0];

    // Calculate final amount
    const finalAmount = value.total_amount + value.tax_amount - value.discount_amount;

    // Prepare variables for template replacement
    const variables = {
      'invoice_number': invoiceNumber,
      'customer.name': customer.name,
      'customer.email': customer.email || '',
      'customer.phone': customer.phone || '',
      'customer.company': customer.company || '',
      'customer.address': customer.address || '',
      'customer.vat_id': customer.vat_id || '',
      'invoice.total_amount': value.total_amount.toFixed(2),
      'invoice.tax_amount': value.tax_amount.toFixed(2),
      'invoice.discount_amount': value.discount_amount.toFixed(2),
      'invoice.final_amount': finalAmount.toFixed(2),
      'invoice.currency': value.currency,
      'invoice.due_date': value.due_date ? new Date(value.due_date).toLocaleDateString() : '',
      'invoice.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Replace template variables
    let htmlContent = replaceTemplateVariables(template.html_content, variables);

    // Insert invoice
    const [result] = await pool.execute(
      `INSERT INTO invoices (invoice_number, customer_id, project_id, proposal_id, template_id, subject,
       total_amount, currency, tax_amount, discount_amount, final_amount, due_date, status, html_content, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        value.customer_id,
        value.project_id || null,
        value.proposal_id || null,
        value.template_id,
        value.subject || null,
        value.total_amount,
        value.currency,
        value.tax_amount,
        value.discount_amount,
        finalAmount,
        value.due_date || null,
        value.status,
        htmlContent,
        value.notes || null,
        req.user.id,
      ]
    );

    const invoiceId = result.insertId;

    // Insert line items
    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        const totalPrice = item.quantity * item.unit_price;
        await pool.execute(
          `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [invoiceId, item.description, item.quantity, item.unit_price, totalPrice]
        );
      }
    }

    // Generate PDF
    const pdfPath = path.join(__dirname, '../../uploads/pdfs', `invoice_${invoiceId}.pdf`);
    await generatePDF(htmlContent, pdfPath);

    // Update invoice with PDF path
    await pool.execute(
      'UPDATE invoices SET pdf_path = ? WHERE id = ?',
      [pdfPath, invoiceId]
    );

    const [invoices] = await pool.execute(
      'SELECT * FROM invoices WHERE id = ?',
      [invoiceId]
    );

    res.status(201).json({ invoice: invoices[0] });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Get existing invoice
    const [existing] = await pool.execute(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get template and customer for HTML regeneration
    const [templates] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [value.template_id]
    );
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [value.customer_id]
    );

    if (templates.length === 0 || customers.length === 0) {
      return res.status(404).json({ error: 'Template or customer not found' });
    }

    const customer = customers[0];
    const template = templates[0];

    // Calculate final amount
    const finalAmount = value.total_amount + value.tax_amount - value.discount_amount;

    // Prepare variables
    const variables = {
      'invoice_number': existing[0].invoice_number,
      'customer.name': customer.name,
      'customer.email': customer.email || '',
      'customer.phone': customer.phone || '',
      'customer.company': customer.company || '',
      'customer.address': customer.address || '',
      'customer.vat_id': customer.vat_id || '',
      'invoice.total_amount': value.total_amount.toFixed(2),
      'invoice.tax_amount': value.tax_amount.toFixed(2),
      'invoice.discount_amount': value.discount_amount.toFixed(2),
      'invoice.final_amount': finalAmount.toFixed(2),
      'invoice.currency': value.currency,
      'invoice.due_date': value.due_date ? new Date(value.due_date).toLocaleDateString() : '',
      'invoice.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    let htmlContent = replaceTemplateVariables(template.html_content, variables);

    // Update invoice
    await pool.execute(
      `UPDATE invoices 
       SET customer_id = ?, project_id = ?, proposal_id = ?, template_id = ?, subject = ?,
       total_amount = ?, currency = ?, tax_amount = ?, discount_amount = ?, final_amount = ?,
       due_date = ?, status = ?, html_content = ?, notes = ?
       WHERE id = ?`,
      [
        value.customer_id,
        value.project_id || null,
        value.proposal_id || null,
        value.template_id,
        value.subject || null,
        value.total_amount,
        value.currency,
        value.tax_amount,
        value.discount_amount,
        finalAmount,
        value.due_date || null,
        value.status,
        htmlContent,
        value.notes || null,
        id,
      ]
    );

    // Update line items (delete old, insert new)
    await pool.execute('DELETE FROM invoice_line_items WHERE invoice_id = ?', [id]);
    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        const totalPrice = item.quantity * item.unit_price;
        await pool.execute(
          `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.description, item.quantity, item.unit_price, totalPrice]
        );
      }
    }

    // Regenerate PDF
    const pdfPath = path.join(__dirname, '../../uploads/pdfs', `invoice_${id}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE invoices SET pdf_path = ? WHERE id = ?', [pdfPath, id]);

    const [invoices] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json({ invoice: invoices[0] });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM invoices WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoices] = await pool.execute(
      'SELECT pdf_path FROM invoices WHERE id = ?',
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const pdfPath = invoices[0].pdf_path;

    if (!pdfPath) {
      return res.status(404).json({ error: 'PDF not generated yet' });
    }

    res.download(pdfPath, `invoice_${id}.pdf`);
  } catch (error) {
    console.error('Download invoice PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF,
};

