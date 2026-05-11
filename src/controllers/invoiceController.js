const pool = require('../config/database');
const Joi = require('joi');
const { generateInvoiceNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const { loadTemplateFile } = require('../services/templateFileService');
const { sendInvoiceEmail } = require('../services/emailService');
const path = require('path');
const { PDF_DIR } = require('../config/paths');

const invoiceSchema = Joi.object({
  client_id: Joi.number().integer().required(),
  project_id: Joi.number().integer().allow(null),
  proposal_id: Joi.number().integer().allow(null),
  payment_stage_id: Joi.number().integer().allow(null),
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
      `SELECT i.*, cl.company_name AS client_name,
       it.name as template_name, p.name as project_name
       FROM invoices i
       LEFT JOIN clients cl ON i.client_id = cl.id
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
      `SELECT i.*,
       cl.company_name AS client_name, cl.address AS client_address, cl.vat_id AS client_vat_id,
       cc.name AS contact_name, cc.email AS contact_email,
       cc.phone AS contact_phone, cc.job_title AS contact_job_title,
       it.name as template_name, p.name as project_name
       FROM invoices i
       LEFT JOIN clients cl ON i.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN invoice_templates it ON i.template_id = it.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [lineItems] = await pool.execute(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ?',
      [id]
    );

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
  const conn = await pool.getConnection();
  try {
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [[template]] = await conn.execute(
      'SELECT id, file_path FROM invoice_templates WHERE id = ?',
      [value.template_id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const [[client]] = await conn.execute(
      `SELECT cl.*, cc.name AS contact_name, cc.email AS contact_email,
              cc.phone AS contact_phone, cc.job_title AS contact_job_title
       FROM clients cl
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE cl.id = ?`,
      [value.client_id]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const invoiceNumber = await generateInvoiceNumber();
    const finalAmount = value.total_amount + value.tax_amount - value.discount_amount;

    const variables = {
      'invoice_number': invoiceNumber,
      'client.company_name': client.company_name,
      'client.address': client.address || '',
      'client.vat_id': client.vat_id || '',
      'contact.name': client.contact_name || '',
      'contact.email': client.contact_email || '',
      'contact.phone': client.contact_phone || '',
      'contact.job_title': client.contact_job_title || '',
      // Legacy aliases
      'customer.name': client.contact_name || client.company_name,
      'customer.email': client.contact_email || '',
      'customer.phone': client.contact_phone || '',
      'customer.company': client.company_name,
      'customer.address': client.address || '',
      'customer.vat_id': client.vat_id || '',
      'invoice.total_amount': value.total_amount.toFixed(2),
      'invoice.tax_amount': value.tax_amount.toFixed(2),
      'invoice.discount_amount': value.discount_amount.toFixed(2),
      'invoice.final_amount': finalAmount.toFixed(2),
      'invoice.currency': value.currency,
      'invoice.due_date': value.due_date ? new Date(value.due_date).toLocaleDateString() : '',
      'invoice.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Load template from file and merge variables
    const rawHtml = await loadTemplateFile(template.file_path);
    const htmlContent = replaceTemplateVariables(rawHtml, variables);

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO invoices (invoice_number, client_id, project_id, proposal_id, payment_stage_id, template_id, subject,
       total_amount, currency, tax_amount, discount_amount, final_amount, due_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber, value.client_id, value.project_id || null, value.proposal_id || null,
        value.payment_stage_id || null,
        value.template_id, value.subject || null, value.total_amount, value.currency,
        value.tax_amount, value.discount_amount, finalAmount,
        value.due_date || null, value.status, value.notes || null, req.user.id,
      ]
    );

    const invoiceId = result.insertId;

    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        await conn.execute(
          `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [invoiceId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }
    }

    await conn.commit();

    const pdfPath = path.join(PDF_DIR, `invoice_${invoiceId}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE invoices SET pdf_path = ? WHERE id = ?', [pdfPath, invoiceId]);

    const [[invoice]] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json({ invoice });
  } catch (error) {
    await conn.rollback();
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
};

const updateInvoice = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { error, value } = invoiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [[existing]] = await conn.execute('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const [[template]] = await conn.execute(
      'SELECT id, file_path FROM invoice_templates WHERE id = ?',
      [value.template_id]
    );
    const [[client]] = await conn.execute(
      `SELECT cl.*, cc.name AS contact_name, cc.email AS contact_email,
              cc.phone AS contact_phone, cc.job_title AS contact_job_title
       FROM clients cl
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE cl.id = ?`,
      [value.client_id]
    );
    if (!template || !client) return res.status(404).json({ error: 'Template or client not found' });

    const finalAmount = value.total_amount + value.tax_amount - value.discount_amount;

    const variables = {
      'invoice_number': existing.invoice_number,
      'client.company_name': client.company_name,
      'client.address': client.address || '',
      'client.vat_id': client.vat_id || '',
      'contact.name': client.contact_name || '',
      'contact.email': client.contact_email || '',
      'contact.phone': client.contact_phone || '',
      'contact.job_title': client.contact_job_title || '',
      // Legacy aliases
      'customer.name': client.contact_name || client.company_name,
      'customer.email': client.contact_email || '',
      'customer.phone': client.contact_phone || '',
      'customer.company': client.company_name,
      'customer.address': client.address || '',
      'customer.vat_id': client.vat_id || '',
      'invoice.total_amount': value.total_amount.toFixed(2),
      'invoice.tax_amount': value.tax_amount.toFixed(2),
      'invoice.discount_amount': value.discount_amount.toFixed(2),
      'invoice.final_amount': finalAmount.toFixed(2),
      'invoice.currency': value.currency,
      'invoice.due_date': value.due_date ? new Date(value.due_date).toLocaleDateString() : '',
      'invoice.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    const rawHtml = await loadTemplateFile(template.file_path);
    const htmlContent = replaceTemplateVariables(rawHtml, variables);

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE invoices
       SET client_id = ?, project_id = ?, proposal_id = ?, payment_stage_id = ?, template_id = ?, subject = ?,
           total_amount = ?, currency = ?, tax_amount = ?, discount_amount = ?, final_amount = ?,
           due_date = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        value.client_id, value.project_id || null, value.proposal_id || null,
        value.payment_stage_id !== undefined ? (value.payment_stage_id || null) : existing.payment_stage_id,
        value.template_id, value.subject || null, value.total_amount, value.currency,
        value.tax_amount, value.discount_amount, finalAmount,
        value.due_date || null, value.status, value.notes || null, id,
      ]
    );

    // If invoice is being marked paid, mark the linked payment stage paid too
    if (value.status === 'paid' && existing.payment_stage_id) {
      await pool.execute("UPDATE payment_stages SET status='paid' WHERE id=?", [existing.payment_stage_id]);
    }

    await conn.execute('DELETE FROM invoice_line_items WHERE invoice_id = ?', [id]);
    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        await conn.execute(
          `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }
    }

    await conn.commit();

    const pdfPath = path.join(PDF_DIR, `invoice_${id}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE invoices SET pdf_path = ? WHERE id = ?', [pdfPath, id]);

    const [[invoice]] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [id]);
    res.json({ invoice });
  } catch (error) {
    await conn.rollback();
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
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

const sendInvoiceEmailToCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const [[invoice]] = await pool.execute(
      `SELECT i.*, cl.company_name AS client_name,
       cc.name AS contact_name, cc.email AS contact_email
       FROM invoices i
       LEFT JOIN clients cl ON i.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE i.id = ?`,
      [id]
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.pdf_path) return res.status(400).json({ error: 'PDF not generated yet. Save the invoice first.' });
    if (!invoice.contact_email) return res.status(400).json({ error: 'Primary contact has no email address' });

    await sendInvoiceEmail(
      invoice.contact_email,
      invoice.contact_name || invoice.client_name,
      invoice.invoice_number,
      invoice.pdf_path
    );

    await pool.execute("UPDATE invoices SET status = 'sent' WHERE id = ? AND status = 'draft'", [id]);

    res.json({ message: 'Invoice emailed successfully' });
  } catch (error) {
    console.error('Send invoice email error:', error);
    res.status(500).json({ error: 'Failed to send email. Please check email configuration.' });
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF,
  sendInvoiceEmailToCustomer,
};
