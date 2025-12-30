const pool = require('../config/database');
const Joi = require('joi');
const { generateServiceAgreementNumber } = require('../services/numberingService');
const { generatePDF, replaceTemplateVariables } = require('../services/pdfService');
const path = require('path');

const serviceAgreementSchema = Joi.object({
  project_id: Joi.number().integer().required(),
  template_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  status: Joi.string().valid('pending', 'signed', 'rejected').default('pending'),
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
 *                         enum: ["pending", "signed", "rejected"]
 *       500:
 *         description: Internal server error
 */
const getServiceAgreements = async (req, res) => {
  try {
    const [agreements] = await pool.execute(
      `SELECT sa.*, p.name as project_name, p.customer_id,
       c.name as customer_name, sat.name as template_name
       FROM service_agreements sa
       LEFT JOIN projects p ON sa.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
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
      `SELECT sa.*, p.name as project_name, p.customer_id,
       c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
       c.company as customer_company, c.address as customer_address,
       sat.name as template_name
       FROM service_agreements sa
       LEFT JOIN projects p ON sa.project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
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
 *                 enum: ["pending", "signed", "rejected"]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service agreement created successfully
 *       400:
 *         description: Validation error
 */
const createServiceAgreement = async (req, res) => {
  try {
    const { error, value } = serviceAgreementSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Generate agreement number
    const agreementNumber = await generateServiceAgreementNumber();

    // Get template
    const [templates] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [value.template_id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get project
    const [projects] = await pool.execute(
      `SELECT p.*, c.name as customer_name, c.email as customer_email, 
       c.phone as customer_phone, c.company as customer_company, c.address as customer_address
       FROM projects p
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.id = ?`,
      [value.project_id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projects[0];
    const template = templates[0];

    // Prepare variables for template replacement
    const variables = {
      'agreement_number': agreementNumber,
      'project.name': project.name || '',
      'customer.name': project.customer_name || '',
      'customer.email': project.customer_email || '',
      'customer.phone': project.customer_phone || '',
      'customer.company': project.customer_company || '',
      'customer.address': project.customer_address || '',
      'agreement.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Replace template variables
    let htmlContent = replaceTemplateVariables(template.html_content, variables);

    // Insert service agreement
    const [result] = await pool.execute(
      `INSERT INTO service_agreements (agreement_number, project_id, template_id, subject, html_content, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agreementNumber,
        value.project_id,
        value.template_id,
        value.subject || null,
        htmlContent,
        value.status,
        value.notes || null,
        req.user.id,
      ]
    );

    const agreementId = result.insertId;

    // Generate PDF
    const pdfPath = path.join(__dirname, '../../uploads/pdfs', `service_agreement_${agreementId}.pdf`);
    await generatePDF(htmlContent, pdfPath);

    // Update service agreement with PDF path
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
 *     description: Update a service agreement. All required fields must be provided.
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
 *                 enum: ["pending", "signed", "rejected"]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service agreement updated successfully
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

    // Get existing agreement
    const [existing] = await pool.execute(
      'SELECT * FROM service_agreements WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }

    // Get template
    const [templates] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [value.template_id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get project
    const [projects] = await pool.execute(
      `SELECT p.*, c.name as customer_name, c.email as customer_email, 
       c.phone as customer_phone, c.company as customer_company, c.address as customer_address
       FROM projects p
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.id = ?`,
      [value.project_id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projects[0];
    const template = templates[0];

    // Prepare variables for template replacement
    const variables = {
      'agreement_number': existing[0].agreement_number,
      'project.name': project.name || '',
      'customer.name': project.customer_name || '',
      'customer.email': project.customer_email || '',
      'customer.phone': project.customer_phone || '',
      'customer.company': project.customer_company || '',
      'customer.address': project.customer_address || '',
      'agreement.subject': value.subject || '',
      'date': new Date().toLocaleDateString(),
    };

    // Replace template variables
    let htmlContent = replaceTemplateVariables(template.html_content, variables);

    // Update service agreement
    await pool.execute(
      `UPDATE service_agreements 
       SET project_id = ?, template_id = ?, subject = ?, html_content = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        value.project_id,
        value.template_id,
        value.subject || null,
        htmlContent,
        value.status,
        value.notes || null,
        id,
      ]
    );

    // Regenerate PDF
    const pdfPath = path.join(__dirname, '../../uploads/pdfs', `service_agreement_${id}.pdf`);
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

    const agreement = agreements[0];

    // Delete PDF file
    if (agreement.pdf_path) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(agreement.pdf_path);
      } catch (unlinkError) {
        console.error('Error deleting PDF:', unlinkError);
      }
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

    // Check if file exists
    const fs = require('fs').promises;
    try {
      await fs.access(agreement.pdf_path);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on server' });
    }

    const fileName = `service-agreement-${agreement.agreement_number}.pdf`;
    res.download(agreement.pdf_path, fileName);
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
 *                 enum: ["pending", "signed", "rejected"]
 *                 description: New status for the service agreement
 *                 example: "signed"
 *     responses:
 *       200:
 *         description: Service agreement status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     agreement_number:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid status. Valid values: pending, signed, rejected"
 *       404:
 *         description: Service agreement not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service agreement not found"
 *       500:
 *         description: Internal server error
 */
const updateServiceAgreementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'signed', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Valid values: pending, signed, rejected' });
    }

    // Check if agreement exists
    const [existing] = await pool.execute(
      'SELECT id FROM service_agreements WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Service agreement not found' });
    }

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

