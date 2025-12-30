const pool = require('../config/database');
const Joi = require('joi');
const { generateProposalNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const { sendProposalEmail } = require('../services/emailService');
const path = require('path');

const proposalSchema = Joi.object({
  customer_id: Joi.number().integer().required(),
  project_id: Joi.number().integer().allow(null),
  template_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  total_amount: Joi.number().positive().required(),
  currency: Joi.string().default('LKR'),
  valid_until: Joi.date().allow(null),
  status: Joi.string().valid('draft', 'sent', 'accepted', 'declined', 'expired').default('draft'),
  notes: Joi.string().allow('', null),
  line_items: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().positive().default(1),
      unit_price: Joi.number().positive().required(),
    })
  ).optional(),
  payment_stages: Joi.array().items(
    Joi.object({
      stage_name: Joi.string().required(),
      percentage: Joi.number().min(0).max(100).required(),
      due_date: Joi.date().allow(null),
    })
  ).optional(),
});

const getProposals = async (req, res) => {
  try {
    const [proposals] = await pool.execute(
      `SELECT p.*, c.name as customer_name, c.email as customer_email,
       pt.name as template_name, pr.name as project_name
       FROM proposals p
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN proposal_templates pt ON p.template_id = pt.id
       LEFT JOIN projects pr ON p.project_id = pr.id
       ORDER BY p.created_at DESC`
    );
    res.json({ proposals });
  } catch (error) {
    console.error('Get proposals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProposalById = async (req, res) => {
  try {
    const { id } = req.params;

    const [proposals] = await pool.execute(
      `SELECT p.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
       c.company as customer_company, c.address as customer_address,
       pt.name as template_name, pr.name as project_name
       FROM proposals p
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN proposal_templates pt ON p.template_id = pt.id
       LEFT JOIN projects pr ON p.project_id = pr.id
       WHERE p.id = ?`,
      [id]
    );

    if (proposals.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get line items
    const [lineItems] = await pool.execute(
      'SELECT * FROM proposal_line_items WHERE proposal_id = ?',
      [id]
    );

    // Get payment stages
    const [paymentStages] = await pool.execute(
      'SELECT * FROM payment_stages WHERE proposal_id = ? ORDER BY id ASC',
      [id]
    );

    res.json({
      proposal: proposals[0],
      line_items: lineItems,
      payment_stages: paymentStages,
    });
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createProposal = async (req, res) => {
  try {
    const { error, value } = proposalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Generate proposal number
    const proposalNumber = await generateProposalNumber();

    // Get template
    const [templates] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
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

    // Prepare variables for template replacement
    const variables = {
      'proposal_number': proposalNumber,
      'customer.name': customer.name,
      'customer.email': customer.email || '',
      'customer.phone': customer.phone || '',
      'customer.company': customer.company || '',
      'customer.address': customer.address || '',
      'proposal.total_amount': value.total_amount.toFixed(2),
      'proposal.currency': value.currency,
      'proposal.valid_until': value.valid_until ? new Date(value.valid_until).toLocaleDateString() : '',
      'proposal.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Replace template variables
    let htmlContent = replaceTemplateVariables(template.html_content, variables);

    // Insert proposal
    const [result] = await pool.execute(
      `INSERT INTO proposals (proposal_number, customer_id, project_id, template_id, subject,
       total_amount, currency, valid_until, status, html_content, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        proposalNumber,
        value.customer_id,
        value.project_id || null,
        value.template_id,
        value.subject || null,
        value.total_amount,
        value.currency,
        value.valid_until || null,
        value.status,
        htmlContent,
        value.notes || null,
        req.user.id,
      ]
    );

    const proposalId = result.insertId;

    // Insert line items
    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        const totalPrice = item.quantity * item.unit_price;
        await pool.execute(
          `INSERT INTO proposal_line_items (proposal_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [proposalId, item.description, item.quantity, item.unit_price, totalPrice]
        );
      }
    }

    // Insert payment stages
    if (value.payment_stages && value.payment_stages.length > 0) {
      for (const stage of value.payment_stages) {
        const amount = (value.total_amount * stage.percentage) / 100;
        await pool.execute(
          `INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`,
          [proposalId, stage.stage_name, stage.percentage, amount, stage.due_date || null]
        );
      }
    }

    // Generate PDF
    const pdfPath = path.join(__dirname, '../../uploads/pdfs', `proposal_${proposalId}.pdf`);
    await generatePDF(htmlContent, pdfPath);

    // Update proposal with PDF path
    await pool.execute(
      'UPDATE proposals SET pdf_path = ? WHERE id = ?',
      [pdfPath, proposalId]
    );

    const [proposals] = await pool.execute(
      'SELECT * FROM proposals WHERE id = ?',
      [proposalId]
    );

    res.status(201).json({ proposal: proposals[0] });
  } catch (error) {
    console.error('Create proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = proposalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Get existing proposal
    const [existing] = await pool.execute(
      'SELECT * FROM proposals WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get template and customer for HTML regeneration
    const [templates] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
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

    // Prepare variables
    const variables = {
      'proposal_number': existing[0].proposal_number,
      'customer.name': customer.name,
      'customer.email': customer.email || '',
      'customer.phone': customer.phone || '',
      'customer.company': customer.company || '',
      'customer.address': customer.address || '',
      'proposal.total_amount': value.total_amount.toFixed(2),
      'proposal.currency': value.currency,
      'proposal.valid_until': value.valid_until ? new Date(value.valid_until).toLocaleDateString() : '',
      'proposal.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    let htmlContent = replaceTemplateVariables(template.html_content, variables);

    // Update proposal
    await pool.execute(
      `UPDATE proposals 
       SET customer_id = ?, project_id = ?, template_id = ?, subject = ?,
       total_amount = ?, currency = ?, valid_until = ?, status = ?, html_content = ?, notes = ?
       WHERE id = ?`,
      [
        value.customer_id,
        value.project_id || null,
        value.template_id,
        value.subject || null,
        value.total_amount,
        value.currency,
        value.valid_until || null,
        value.status,
        htmlContent,
        value.notes || null,
        id,
      ]
    );

    // Update line items (delete old, insert new)
    await pool.execute('DELETE FROM proposal_line_items WHERE proposal_id = ?', [id]);
    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        const totalPrice = item.quantity * item.unit_price;
        await pool.execute(
          `INSERT INTO proposal_line_items (proposal_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.description, item.quantity, item.unit_price, totalPrice]
        );
      }
    }

    // Update payment stages
    await pool.execute('DELETE FROM payment_stages WHERE proposal_id = ?', [id]);
    if (value.payment_stages && value.payment_stages.length > 0) {
      for (const stage of value.payment_stages) {
        const amount = (value.total_amount * stage.percentage) / 100;
        await pool.execute(
          `INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`,
          [id, stage.stage_name, stage.percentage, amount, stage.due_date || null]
        );
      }
    }

    // Regenerate PDF
    const pdfPath = path.join(__dirname, '../../uploads/pdfs', `proposal_${id}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE proposals SET pdf_path = ? WHERE id = ?', [pdfPath, id]);

    const [proposals] = await pool.execute('SELECT * FROM proposals WHERE id = ?', [id]);
    res.json({ proposal: proposals[0] });
  } catch (error) {
    console.error('Update proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM proposals WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json({ message: 'Proposal deleted successfully' });
  } catch (error) {
    console.error('Delete proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateProposalPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const [proposals] = await pool.execute(
      'SELECT pdf_path FROM proposals WHERE id = ?',
      [id]
    );

    if (proposals.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const pdfPath = proposals[0].pdf_path;

    if (!pdfPath) {
      return res.status(404).json({ error: 'PDF not generated yet' });
    }

    res.download(pdfPath, `proposal_${id}.pdf`);
  } catch (error) {
    console.error('Download proposal PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendProposalEmailToCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Get proposal with customer details
    const [proposals] = await pool.execute(
      `SELECT p.*, c.name as customer_name, c.email as customer_email
       FROM proposals p
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    if (proposals.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = proposals[0];

    if (!proposal.pdf_path) {
      return res.status(400).json({ error: 'PDF not generated yet. Please generate PDF first.' });
    }

    if (!proposal.customer_email) {
      return res.status(400).json({ error: 'Customer email not found' });
    }

    // Send email
    await sendProposalEmail(
      proposal.customer_email,
      proposal.customer_name,
      proposal.proposal_number,
      proposal.pdf_path
    );

    // Update proposal status to 'sent'
    await pool.execute(
      'UPDATE proposals SET status = ? WHERE id = ?',
      ['sent', id]
    );

    res.json({ message: 'Proposal email sent successfully' });
  } catch (error) {
    console.error('Send proposal email error:', error);
    res.status(500).json({ error: 'Failed to send email. Please check email configuration.' });
  }
};

module.exports = {
  getProposals,
  getProposalById,
  createProposal,
  updateProposal,
  deleteProposal,
  generateProposalPDF,
  sendProposalEmailToCustomer,
};

