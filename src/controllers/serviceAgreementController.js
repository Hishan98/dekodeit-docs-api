const pool = require('../config/database');
const Joi = require('joi');
const { generateServiceAgreementNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const { loadTemplateFile } = require('../services/templateFileService');
const path = require('path');
const { PDF_DIR } = require('../config/paths');

const serviceAgreementSchema = Joi.object({
  project_id: Joi.number().integer().required(),
  template_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  status: Joi.string().valid('draft', 'sent', 'revision_requested', 'resubmitted', 'signed', 'rejected').default('draft'),
  notes: Joi.string().allow('', null),
});

/**
 * @swagger
 * /api/service-agreements:
 *   get:
 *     summary: Get all service agreements
 *     description: Retrieve a list of all service agreements with project and customer information
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of service agreements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreements:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       agreement_number:
 *                         type: string
 *                         example: "S250101"
 *                       project_id:
 *                         type: integer
 *                       project_name:
 *                         type: string
 *                       customer_name:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: ["draft","sent","revision_requested","resubmitted","signed","rejected"]
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/service-agreements/{id}:
 *   get:
 *     summary: Get service agreement by ID
 *     description: Retrieve a specific service agreement by its ID
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Service agreement ID
 *     responses:
 *       200:
 *         description: Service agreement details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   type: object
 *       404:
 *         description: Service agreement not found
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/service-agreements:
 *   post:
 *     summary: Create a new service agreement
 *     description: >
 *       Creates a service agreement by merging project/customer data into the selected
 *       template (loaded from its HTML file) and generating a PDF immediately.
 *       The html_content is never stored in the database.
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - template_id
 *             properties:
 *               project_id:
 *                 type: integer
 *               template_id:
 *                 type: integer
 *               subject:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: ["draft","sent","revision_requested","resubmitted","signed","rejected"]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service agreement created — PDF generated immediately
 *       400:
 *         description: Validation error
 */
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
      // Legacy aliases for existing templates
      'customer.name': project.contact_name || project.client_name || '',
      'customer.email': project.contact_email || '',
      'customer.phone': project.contact_phone || '',
      'customer.company': project.client_name || '',
      'customer.address': project.client_address || '',
      'agreement.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Load template from file and merge variables
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

/**
 * @swagger
 * /api/service-agreements/{id}:
 *   put:
 *     summary: Update a service agreement
 *     description: >
 *       Updates a service agreement and regenerates the PDF from the template file.
 *       The html_content is never stored in the database.
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Service agreement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - template_id
 *             properties:
 *               project_id:
 *                 type: integer
 *               template_id:
 *                 type: integer
 *               subject:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: ["draft","sent","revision_requested","resubmitted","signed","rejected"]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service agreement updated — PDF regenerated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Service agreement or related resource not found
 *       500:
 *         description: Internal server error
 */
const updateServiceAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = serviceAgreementSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [existing] = await pool.execute(
      'SELECT * FROM service_agreements WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Service agreement not found' });

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
      // Legacy aliases for existing templates
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

/**
 * @swagger
 * /api/service-agreements/{id}:
 *   delete:
 *     summary: Delete a service agreement
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 */
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
      const fs = require('fs').promises;
      await fs.unlink(agreements[0].pdf_path).catch(() => {});
    }

    await pool.execute('DELETE FROM service_agreements WHERE id = ?', [id]);

    res.json({ message: 'Service agreement deleted successfully' });
  } catch (error) {
    console.error('Delete service agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/service-agreements/{id}/pdf:
 *   get:
 *     summary: Download service agreement PDF
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 */
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

    const fs = require('fs').promises;
    try {
      await fs.access(agreement.pdf_path);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on server' });
    }

    res.download(agreement.pdf_path, `service-agreement-${agreement.agreement_number}.pdf`);
  } catch (error) {
    console.error('Download service agreement PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/service-agreements/{id}/status:
 *   put:
 *     summary: Update service agreement status only
 *     description: Updates only the status field of a service agreement without requiring other fields
 *     tags: [Service Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Service agreement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["draft","sent","revision_requested","resubmitted","signed","rejected"]
 *                 example: "signed"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Service agreement not found
 *       500:
 *         description: Internal server error
 */
const updateServiceAgreementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'sent', 'revision_requested', 'resubmitted', 'signed', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM service_agreements WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Service agreement not found' });

    await pool.execute(
      'UPDATE service_agreements SET status = ? WHERE id = ?',
      [status, id]
    );

    const [agreements] = await pool.execute(
      'SELECT * FROM service_agreements WHERE id = ?',
      [id]
    );

    res.json({ agreement: agreements[0] });
  } catch (error) {
    console.error('Update service agreement status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getServiceAgreements,
  getServiceAgreementById,
  createServiceAgreement,
  updateServiceAgreement,
  updateServiceAgreementStatus,
  deleteServiceAgreement,
  downloadServiceAgreementPDF,
};
