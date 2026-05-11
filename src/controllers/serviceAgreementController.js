const pool = require('../config/database');
const Joi = require('joi');
const fs = require('fs');
const { generateServiceAgreementNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const { loadTemplateFile } = require('../services/templateFileService');
const { sendServiceAgreementEmail, sendServiceAgreementSignedEmail } = require('../services/emailService');
const path = require('path');
const { PDF_DIR } = require('../config/paths');

const serviceAgreementSchema = Joi.object({
  project_id: Joi.number().integer().required(),
  template_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  status: Joi.string().valid('draft', 'sent', 'revision_requested', 'resubmitted', 'signed', 'rejected').default('draft'),
  notes: Joi.string().allow('', null),
});

const uploadServiceAgreementSchema = Joi.object({
  project_id: Joi.number().integer().required(),
  subject:    Joi.string().allow('', null),
  status:     Joi.string().valid('draft', 'sent', 'revision_requested', 'resubmitted', 'signed', 'rejected').default('draft'),
  notes:      Joi.string().allow('', null),
});

const getServiceAgreements = async (req, res) => {
  try {
    const [agreements] = await pool.execute(
      `SELECT sa.*, p.name as project_name, p.client_id,
       cl.company_name as client_name, sat.name as template_name
       FROM service_agreements sa
       LEFT JOIN projects p ON sa.project_id = p.id
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN service_agreement_templates sat ON sa.template_id = sat.id
       ORDER BY sa.created_at DESC`
    );
    res.json({ agreements });
  } catch (error) {
    console.error('Get service agreements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getServiceAgreementById = async (req, res) => {
  try {
    const { id } = req.params;

    const [agreements] = await pool.execute(
      `SELECT sa.*, p.name as project_name, p.client_id,
       cl.company_name as client_name, cl.address as client_address,
       cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone,
       sat.name as template_name
       FROM service_agreements sa
       LEFT JOIN projects p ON sa.project_id = p.id
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN service_agreement_templates sat ON sa.template_id = sat.id
       WHERE sa.id = ?`,
      [id]
    );

    if (agreements.length === 0) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }

    res.json({ agreement: agreements[0] });
  } catch (error) {
    console.error('Get service agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createServiceAgreement = async (req, res) => {
  try {
    const { error, value } = serviceAgreementSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const agreementNumber = await generateServiceAgreementNumber();

    const [[template]] = await pool.execute(
      'SELECT id, file_path FROM service_agreement_templates WHERE id = ?',
      [value.template_id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const [projects] = await pool.execute(
      `SELECT p.*, cl.company_name as client_name, cl.address as client_address,
       cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone
       FROM projects p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE p.id = ?`,
      [value.project_id]
    );
    if (projects.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = projects[0];

    const variables = {
      'agreement_number': agreementNumber,
      'project.name': project.name || '',
      'client.company_name': project.client_name || '',
      'client.address': project.client_address || '',
      'contact.name': project.contact_name || '',
      'contact.email': project.contact_email || '',
      'contact.phone': project.contact_phone || '',
      'customer.name': project.contact_name || project.client_name || '',
      'customer.email': project.contact_email || '',
      'customer.phone': project.contact_phone || '',
      'customer.company': project.client_name || '',
      'customer.address': project.client_address || '',
      'agreement.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    const rawHtml = await loadTemplateFile(template.file_path);
    const htmlContent = replaceTemplateVariables(rawHtml, variables);

    const [result] = await pool.execute(
      `INSERT INTO service_agreements (agreement_number, project_id, template_id, subject, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        agreementNumber,
        value.project_id,
        value.template_id,
        value.subject || null,
        value.status,
        value.notes || null,
        req.user.id,
      ]
    );

    const agreementId = result.insertId;

    const pdfPath = path.join(PDF_DIR, `service_agreement_${agreementId}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute(
      'UPDATE service_agreements SET pdf_path = ? WHERE id = ?',
      [pdfPath, agreementId]
    );

    const [agreements] = await pool.execute(
      'SELECT * FROM service_agreements WHERE id = ?',
      [agreementId]
    );

    res.status(201).json({ agreement: agreements[0] });
  } catch (error) {
    console.error('Create service agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateServiceAgreement = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute(
      'SELECT * FROM service_agreements WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Service agreement not found' });

    // Uploaded SAs: update metadata only, skip template/PDF regeneration
    if (existing[0].source === 'upload') {
      const { error, value } = uploadServiceAgreementSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      await pool.execute(
        'UPDATE service_agreements SET project_id=?, subject=?, status=?, notes=? WHERE id=?',
        [value.project_id, value.subject || null, value.status, value.notes || null, id]
      );

      const [[agr]] = await pool.execute('SELECT * FROM service_agreements WHERE id=?', [id]);
      return res.json({ agreement: agr });
    }

    // Template-based SA: validate full schema and regenerate PDF
    const { error, value } = serviceAgreementSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [[template]] = await pool.execute(
      'SELECT id, file_path FROM service_agreement_templates WHERE id = ?',
      [value.template_id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const [projects] = await pool.execute(
      `SELECT p.*, cl.company_name as client_name, cl.address as client_address,
       cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone
       FROM projects p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE p.id = ?`,
      [value.project_id]
    );
    if (projects.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = projects[0];

    const variables = {
      'agreement_number': existing[0].agreement_number,
      'project.name': project.name || '',
      'client.company_name': project.client_name || '',
      'client.address': project.client_address || '',
      'contact.name': project.contact_name || '',
      'contact.email': project.contact_email || '',
      'contact.phone': project.contact_phone || '',
      'customer.name': project.contact_name || project.client_name || '',
      'customer.email': project.contact_email || '',
      'customer.phone': project.contact_phone || '',
      'customer.company': project.client_name || '',
      'customer.address': project.client_address || '',
      'agreement.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    const rawHtml = await loadTemplateFile(template.file_path);
    const htmlContent = replaceTemplateVariables(rawHtml, variables);

    await pool.execute(
      `UPDATE service_agreements
       SET project_id = ?, template_id = ?, subject = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        value.project_id,
        value.template_id,
        value.subject || null,
        value.status,
        value.notes || null,
        id,
      ]
    );

    const pdfPath = path.join(PDF_DIR, `service_agreement_${id}.pdf`);
    await generatePDF(htmlContent, pdfPath);
    await pool.execute('UPDATE service_agreements SET pdf_path = ? WHERE id = ?', [pdfPath, id]);

    const [agreements] = await pool.execute(
      'SELECT * FROM service_agreements WHERE id = ?',
      [id]
    );

    res.json({ agreement: agreements[0] });
  } catch (error) {
    console.error('Update service agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/service-agreements/upload
// ---------------------------------------------------------------------------
const uploadServiceAgreement = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { error, value } = uploadServiceAgreementSchema.validate(req.body);
    if (error) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: error.details[0].message });
    }

    const [proj] = await pool.execute('SELECT id FROM projects WHERE id = ?', [value.project_id]);
    if (proj.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Project not found' });
    }

    const agreementNumber = await generateServiceAgreementNumber();
    const filePath = `/uploads/service-agreements/${req.file.filename}`;

    const [result] = await pool.execute(
      `INSERT INTO service_agreements (agreement_number, project_id, template_id, subject, status, notes, source, pdf_path, created_by)
       VALUES (?, ?, NULL, ?, ?, ?, 'upload', ?, ?)`,
      [agreementNumber, value.project_id, value.subject || null, value.status, value.notes || null, filePath, req.user.id]
    );

    const [[agr]] = await pool.execute('SELECT * FROM service_agreements WHERE id = ?', [result.insertId]);
    res.status(201).json({ agreement: agr });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Upload service agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/service-agreements/:id/replace-file
// ---------------------------------------------------------------------------
const replaceServiceAgreementFile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const [[agr]] = await pool.execute(
      'SELECT id, source, pdf_path FROM service_agreements WHERE id = ?',
      [id]
    );

    if (!agr) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Service agreement not found' });
    }

    if (agr.pdf_path && agr.pdf_path.startsWith('/uploads/service-agreements/')) {
      const oldAbsPath = path.join(__dirname, '../../', agr.pdf_path.replace(/^\//, ''));
      if (fs.existsSync(oldAbsPath)) fs.unlinkSync(oldAbsPath);
    }

    const newPath = `/uploads/service-agreements/${req.file.filename}`;
    await pool.execute(
      'UPDATE service_agreements SET pdf_path = ?, source = ? WHERE id = ?',
      [newPath, 'upload', id]
    );

    const [[updated]] = await pool.execute('SELECT * FROM service_agreements WHERE id = ?', [id]);
    res.json({ agreement: updated, message: 'File replaced successfully' });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Replace service agreement file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteServiceAgreement = async (req, res) => {
  try {
    const { id } = req.params;

    const [agreements] = await pool.execute(
      'SELECT pdf_path FROM service_agreements WHERE id = ?',
      [id]
    );

    if (agreements.length === 0) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }

    if (agreements[0].pdf_path) {
      // Template PDFs stored as absolute paths; uploaded files as /uploads/... relative URLs
      const filePath = agreements[0].pdf_path.startsWith('/')
        ? path.join(__dirname, '../../', agreements[0].pdf_path.replace(/^\//, ''))
        : agreements[0].pdf_path;
      await fs.promises.unlink(filePath).catch(() => {});
    }

    await pool.execute('DELETE FROM service_agreements WHERE id = ?', [id]);

    res.json({ message: 'Service agreement deleted successfully' });
  } catch (error) {
    console.error('Delete service agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const downloadServiceAgreementPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const [agreements] = await pool.execute(
      'SELECT pdf_path, agreement_number FROM service_agreements WHERE id = ?',
      [id]
    );

    if (agreements.length === 0) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }

    const agreement = agreements[0];

    if (!agreement.pdf_path) {
      return res.status(404).json({ error: 'PDF not generated yet' });
    }

    // Resolve relative URL paths (uploaded files) to absolute filesystem paths
    const absPath = agreement.pdf_path.startsWith('/')
      ? path.join(__dirname, '../../', agreement.pdf_path.replace(/^\//, ''))
      : agreement.pdf_path;

    try {
      await fs.promises.access(absPath);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on server' });
    }

    res.download(absPath, `service-agreement-${agreement.agreement_number}.pdf`);
  } catch (error) {
    console.error('Download service agreement PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateServiceAgreementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'sent', 'revision_requested', 'resubmitted', 'signed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const [[existing]] = await pool.execute(
      `SELECT sa.id, sa.status AS current_status, sa.agreement_number,
       p.name AS project_name,
       cc.name AS contact_name, cc.email AS contact_email,
       cl.company_name AS client_name
       FROM service_agreements sa
       LEFT JOIN projects p ON sa.project_id = p.id
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE sa.id = ?`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Service agreement not found' });

    await pool.execute('UPDATE service_agreements SET status = ? WHERE id = ?', [status, id]);

    const [[agreement]] = await pool.execute('SELECT * FROM service_agreements WHERE id = ?', [id]);

    // Send signed confirmation - fire-and-forget (don't block the response)
    if (status === 'signed' && existing.current_status !== 'signed' && existing.contact_email) {
      sendServiceAgreementSignedEmail(
        existing.contact_email,
        existing.contact_name || existing.client_name,
        existing.agreement_number,
        existing.project_name
      ).catch((err) => console.error('[Email] SA signed email failed:', err.message));
    }

    res.json({ agreement });
  } catch (error) {
    console.error('Update service agreement status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendServiceAgreementEmailToCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const [[sa]] = await pool.execute(
      `SELECT sa.*, cl.company_name AS client_name,
       cc.name AS contact_name, cc.email AS contact_email
       FROM service_agreements sa
       LEFT JOIN projects p ON sa.project_id = p.id
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       WHERE sa.id = ?`,
      [id]
    );

    if (!sa) return res.status(404).json({ error: 'Service agreement not found' });

    if (!sa.pdf_path) {
      return res.status(400).json({ error: 'PDF not generated yet. Please generate PDF first.' });
    }

    if (!sa.contact_email) {
      return res.status(400).json({ error: 'Primary contact has no email address' });
    }

    // Resolve relative URL to absolute filesystem path for uploaded files
    const absPath = sa.pdf_path.startsWith('/')
      ? path.join(__dirname, '../../', sa.pdf_path.replace(/^\//, ''))
      : sa.pdf_path;

    await sendServiceAgreementEmail(
      sa.contact_email,
      sa.contact_name || sa.client_name,
      sa.agreement_number,
      absPath
    );

    const newStatus = sa.status === 'revision_requested' ? 'resubmitted' : 'sent';
    await pool.execute('UPDATE service_agreements SET status = ? WHERE id = ?', [newStatus, id]);

    res.json({ message: 'Service agreement email sent successfully' });
  } catch (error) {
    console.error('Send service agreement email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
};

module.exports = {
  getServiceAgreements,
  getServiceAgreementById,
  createServiceAgreement,
  uploadServiceAgreement,
  replaceServiceAgreementFile,
  updateServiceAgreement,
  updateServiceAgreementStatus,
  deleteServiceAgreement,
  downloadServiceAgreementPDF,
  sendServiceAgreementEmailToCustomer,
};
