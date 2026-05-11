const pool = require('../config/database');
const Joi = require('joi');
const { generateProposalNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const { loadTemplateFile } = require('../services/templateFileService');
const { sendProposalEmail, sendProposalAcceptedEmail } = require('../services/emailService');
const path = require('path');
const fs = require('fs');
const { PDF_DIR } = require('../config/paths');

const proposalSchema = Joi.object({
  client_id: Joi.number().integer().required(),
  project_id: Joi.number().integer().allow(null),
  template_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  total_amount: Joi.number().positive().required(),
  currency: Joi.string().default('LKR'),
  valid_until: Joi.date().allow(null),
  status: Joi.string().valid('draft', 'sent', 'revision_requested', 'resubmitted', 'accepted', 'declined', 'expired').default('draft'),
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

// Schema for updates - template_id is optional to support uploaded proposals
const proposalUpdateSchema = Joi.object({
  client_id: Joi.number().integer().required(),
  project_id: Joi.number().integer().allow(null),
  template_id: Joi.number().integer().allow(null),
  subject: Joi.string().allow('', null),
  total_amount: Joi.number().positive().required(),
  currency: Joi.string().default('LKR'),
  valid_until: Joi.date().allow(null),
  status: Joi.string().valid('draft', 'sent', 'revision_requested', 'resubmitted', 'accepted', 'declined', 'expired').default('draft'),
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
      `SELECT p.*, cl.company_name AS client_name,
       pt.name as template_name, pr.name as project_name
       FROM proposals p
       LEFT JOIN clients cl ON p.client_id = cl.id
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
      `SELECT p.*,
       cl.company_name AS client_name, cl.address AS client_address,
       cc.name AS contact_name, cc.email AS contact_email,
       cc.phone AS contact_phone, cc.job_title AS contact_job_title,
       pt.name as template_name, pr.name as project_name
       FROM proposals p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN proposal_templates pt ON p.template_id = pt.id
       LEFT JOIN projects pr ON p.project_id = pr.id
       WHERE p.id = ?`,
      [id]
    );

    if (proposals.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const [lineItems] = await pool.execute(
      'SELECT * FROM proposal_line_items WHERE proposal_id = ?',
      [id]
    );

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
  const conn = await pool.getConnection();
  try {
    const { error, value } = proposalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [[template]] = await conn.execute(
      'SELECT id, file_path FROM proposal_templates WHERE id = ?',
      [value.template_id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Load client + primary contact for PDF variables
    const [[client]] = await conn.execute(
      `SELECT cl.*, cc.name AS contact_name, cc.email AS contact_email,
              cc.phone AS contact_phone, cc.job_title AS contact_job_title
       FROM clients cl
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE cl.id = ?`,
      [value.client_id]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const proposalNumber = await generateProposalNumber();

    const variables = {
      'proposal_number': proposalNumber,
      'client.company_name': client.company_name,
      'client.address': client.address || '',
      'client.vat_id': client.vat_id || '',
      'contact.name': client.contact_name || '',
      'contact.email': client.contact_email || '',
      'contact.phone': client.contact_phone || '',
      'contact.job_title': client.contact_job_title || '',
      // Legacy aliases kept for backward template compatibility
      'customer.name': client.contact_name || client.company_name,
      'customer.email': client.contact_email || '',
      'customer.phone': client.contact_phone || '',
      'customer.company': client.company_name,
      'customer.address': client.address || '',
      'proposal.total_amount': value.total_amount.toFixed(2),
      'proposal.currency': value.currency,
      'proposal.valid_until': value.valid_until ? new Date(value.valid_until).toLocaleDateString() : '',
      'proposal.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Load template from file and merge variables
    const rawHtml = await loadTemplateFile(template.file_path);
    const htmlContent = replaceTemplateVariables(rawHtml, variables);

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO proposals (proposal_number, client_id, project_id, template_id, subject,
       total_amount, currency, valid_until, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        proposalNumber, value.client_id, value.project_id || null, value.template_id,
        value.subject || null, value.total_amount, value.currency,
        value.valid_until || null, value.status, value.notes || null, req.user.id,
      ]
    );

    const proposalId = result.insertId;

    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        await conn.execute(
          `INSERT INTO proposal_line_items (proposal_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [proposalId, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }
    }

    if (value.payment_stages && value.payment_stages.length > 0) {
      for (const stage of value.payment_stages) {
        await conn.execute(
          `INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`,
          [proposalId, stage.stage_name, stage.percentage, (value.total_amount * stage.percentage) / 100, stage.due_date || null]
        );
      }
    }

    await conn.commit();

    // Generate PDF outside transaction (filesystem op - not rolled back anyway)
    const pdfPath = path.join(PDF_DIR, `proposal_${proposalId}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE proposals SET pdf_path = ? WHERE id = ?', [pdfPath, proposalId]);

    const [[proposal]] = await pool.execute('SELECT * FROM proposals WHERE id = ?', [proposalId]);
    res.status(201).json({ proposal });
  } catch (error) {
    await conn.rollback();
    console.error('Create proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
};

const updateProposal = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { error, value } = proposalUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [[existing]] = await conn.execute('SELECT * FROM proposals WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Proposal not found' });

    // Uploaded proposals: update metadata only, skip template/PDF regeneration
    if (existing.source === 'upload') {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE proposals
         SET client_id = ?, project_id = ?, subject = ?,
             total_amount = ?, currency = ?, valid_until = ?, status = ?, notes = ?
         WHERE id = ?`,
        [
          value.client_id, value.project_id || null, value.subject || null,
          value.total_amount, value.currency, value.valid_until || null,
          value.status, value.notes || null, id,
        ]
      );

      await conn.execute('DELETE FROM payment_stages WHERE proposal_id = ?', [id]);
      if (value.payment_stages && value.payment_stages.length > 0) {
        for (const stage of value.payment_stages) {
          await conn.execute(
            `INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [id, stage.stage_name, stage.percentage, (value.total_amount * stage.percentage) / 100, stage.due_date || null]
          );
        }
      }

      await conn.commit();
      const [[proposal]] = await pool.execute('SELECT * FROM proposals WHERE id = ?', [id]);
      return res.json({ proposal });
    }

    if (!value.template_id) {
      return res.status(400).json({ error: 'template_id is required for template-based proposals' });
    }

    const [[template]] = await conn.execute(
      'SELECT id, file_path FROM proposal_templates WHERE id = ?',
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

    const variables = {
      'proposal_number': existing.proposal_number,
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
      'proposal.total_amount': value.total_amount.toFixed(2),
      'proposal.currency': value.currency,
      'proposal.valid_until': value.valid_until ? new Date(value.valid_until).toLocaleDateString() : '',
      'proposal.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    const rawHtml = await loadTemplateFile(template.file_path);
    const htmlContent = replaceTemplateVariables(rawHtml, variables);

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE proposals
       SET client_id = ?, project_id = ?, template_id = ?, subject = ?,
           total_amount = ?, currency = ?, valid_until = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        value.client_id, value.project_id || null, value.template_id, value.subject || null,
        value.total_amount, value.currency, value.valid_until || null,
        value.status, value.notes || null, id,
      ]
    );

    await conn.execute('DELETE FROM proposal_line_items WHERE proposal_id = ?', [id]);
    if (value.line_items && value.line_items.length > 0) {
      for (const item of value.line_items) {
        await conn.execute(
          `INSERT INTO proposal_line_items (proposal_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }
    }

    await conn.execute('DELETE FROM payment_stages WHERE proposal_id = ?', [id]);
    if (value.payment_stages && value.payment_stages.length > 0) {
      for (const stage of value.payment_stages) {
        await conn.execute(
          `INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`,
          [id, stage.stage_name, stage.percentage, (value.total_amount * stage.percentage) / 100, stage.due_date || null]
        );
      }
    }

    await conn.commit();

    const pdfPath = path.join(PDF_DIR, `proposal_${id}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE proposals SET pdf_path = ? WHERE id = ?', [pdfPath, id]);

    const [[proposal]] = await pool.execute('SELECT * FROM proposals WHERE id = ?', [id]);
    res.json({ proposal });
  } catch (error) {
    await conn.rollback();
    console.error('Update proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
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

    const [proposals] = await pool.execute(
      `SELECT p.*, cl.company_name AS client_name,
       cc.name AS contact_name, cc.email AS contact_email
       FROM proposals p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
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

    if (!proposal.contact_email) {
      return res.status(400).json({ error: 'Primary contact has no email address' });
    }

    // Resolve relative URL paths (uploaded files) to absolute filesystem paths
    const absPath = proposal.pdf_path.startsWith('/')
      ? path.join(__dirname, '../../', proposal.pdf_path.replace(/^\//, ''))
      : proposal.pdf_path;

    await sendProposalEmail(
      proposal.contact_email,
      proposal.contact_name || proposal.client_name,
      proposal.proposal_number,
      absPath
    );

    const newStatus = proposal.status === 'revision_requested' ? 'resubmitted' : 'sent';
    await pool.execute(
      'UPDATE proposals SET status = ? WHERE id = ?',
      [newStatus, id]
    );

    res.json({ message: 'Proposal email sent successfully' });
  } catch (error) {
    console.error('Send proposal email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
};

const updateProposalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['draft', 'sent', 'revision_requested', 'resubmitted', 'accepted', 'declined', 'expired'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const [[proposal]] = await pool.execute(
      `SELECT p.id, p.status AS current_status, p.proposal_number,
       cc.name AS contact_name, cc.email AS contact_email,
       cl.company_name AS client_name
       FROM proposals p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE p.id = ?`,
      [id]
    );
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });

    await pool.execute("UPDATE proposals SET status = ? WHERE id = ?", [status, id]);
    const [[updated]] = await pool.execute("SELECT * FROM proposals WHERE id = ?", [id]);

    // Send acceptance confirmation - fire-and-forget (don't block the response)
    if (status === 'accepted' && proposal.current_status !== 'accepted' && proposal.contact_email) {
      sendProposalAcceptedEmail(
        proposal.contact_email,
        proposal.contact_name || proposal.client_name,
        proposal.proposal_number
      ).catch((err) => console.error('[Email] Proposal accepted email failed:', err.message));
    }

    res.json({ proposal: updated });
  } catch (error) {
    console.error("Update proposal status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/proposals/upload
// Creates a proposal by uploading an existing document instead of using a
// template. Accepts multipart/form-data with a file + metadata fields.
// ---------------------------------------------------------------------------
const uploadProposalSchema = Joi.object({
  client_id:      Joi.number().integer().required(),
  project_id:     Joi.number().integer().allow(null),
  subject:        Joi.string().allow('', null),
  total_amount:   Joi.number().min(0).required(),
  currency:       Joi.string().default('LKR'),
  valid_until:    Joi.date().allow(null),
  status:         Joi.string().valid('draft','sent','revision_requested','resubmitted','accepted','declined','expired').default('draft'),
  notes:          Joi.string().allow('', null),
  payment_stages: Joi.string().allow('', null), // JSON-encoded array
});

const uploadProposal = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { error, value } = uploadProposalSchema.validate(req.body);
    if (error) {
      // Remove orphaned file before returning error
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify client exists
    const [[client]] = await conn.execute(
      'SELECT id FROM clients WHERE id = ?', [value.client_id]
    );
    if (!client) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Client not found' });
    }

    // Parse payment_stages JSON if provided
    let paymentStages = [];
    if (value.payment_stages) {
      try {
        paymentStages = JSON.parse(value.payment_stages);
        if (!Array.isArray(paymentStages)) paymentStages = [];
      } catch {
        paymentStages = [];
      }
    }

    const proposalNumber = await generateProposalNumber();
    // Store relative URL path (served as static)
    const filePath = `/uploads/proposals/${req.file.filename}`;

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO proposals
         (proposal_number, client_id, project_id, template_id, subject,
          total_amount, currency, valid_until, status, notes, source, pdf_path, created_by)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'upload', ?, ?)`,
      [
        proposalNumber,
        value.client_id,
        value.project_id || null,
        value.subject    || null,
        value.total_amount,
        value.currency,
        value.valid_until || null,
        value.status,
        value.notes || null,
        filePath,
        req.user.id,
      ]
    );

    const proposalId = result.insertId;

    if (paymentStages.length > 0) {
      for (const stage of paymentStages) {
        const pct = parseFloat(stage.percentage) || 0;
        const amt = (value.total_amount * pct) / 100;
        await conn.execute(
          `INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`,
          [proposalId, stage.stage_name, pct, amt, stage.due_date || null]
        );
      }
    }

    await conn.commit();

    const [[proposal]] = await pool.execute('SELECT * FROM proposals WHERE id = ?', [proposalId]);
    res.status(201).json({ proposal });
  } catch (error) {
    await conn.rollback();
    // Clean up uploaded file on error
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Upload proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------------
// POST /api/proposals/:id/replace-file
// Replaces the uploaded document for an existing upload-sourced proposal.
// ---------------------------------------------------------------------------
const replaceProposalFile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const [[proposal]] = await pool.execute(
      'SELECT id, source, pdf_path FROM proposals WHERE id = ?', [id]
    );

    if (!proposal) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Delete old file from disk if it exists and was inside uploads/proposals/
    if (proposal.pdf_path && proposal.pdf_path.startsWith('/uploads/proposals/')) {
      const oldAbsPath = path.join(__dirname, '../../', proposal.pdf_path.replace(/^\//, ''));
      if (fs.existsSync(oldAbsPath)) fs.unlinkSync(oldAbsPath);
    }

    const newFilePath = `/uploads/proposals/${req.file.filename}`;
    await pool.execute(
      'UPDATE proposals SET pdf_path = ?, source = ? WHERE id = ?',
      [newFilePath, 'upload', id]
    );

    const [[updated]] = await pool.execute('SELECT * FROM proposals WHERE id = ?', [id]);
    res.json({ proposal: updated, message: 'File replaced successfully' });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Replace proposal file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getProposals,
  getProposalById,
  createProposal,
  uploadProposal,
  replaceProposalFile,
  updateProposal,
  deleteProposal,
  generateProposalPDF,
  sendProposalEmailToCustomer,
  updateProposalStatus,
};
