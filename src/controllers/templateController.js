const pool = require('../config/database');
const Joi = require('joi');
const { saveTemplateFile, loadTemplateFile, deleteTemplateFile } = require('../services/templateFileService');

// ── Validation schemas ──────────────────────────────────────────────────────

const templateSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('', null),
  html_content: Joi.string().required(),
  variables: Joi.string().allow('', null),
});

const designDocumentTemplateSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('', null),
});

// ═══════════════════════════════════════════════════════════════════════════
// Proposal Templates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/templates/proposals:
 *   get:
 *     summary: List all proposal templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of proposal template metadata (no html_content)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TemplateMetadata'
 */
const getProposalTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT pt.id, pt.name, pt.description, pt.file_path, pt.variables,
              pt.created_by, pt.created_at, pt.updated_at,
              u.name AS created_by_name
       FROM proposal_templates pt
       LEFT JOIN users u ON pt.created_by = u.id
       ORDER BY pt.created_at DESC`
    );
    res.json({ templates });
  } catch (error) {
    console.error('Get proposal templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/proposals/{id}:
 *   get:
 *     summary: Get a proposal template by ID (includes html_content loaded from file)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template metadata + html_content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 template:
 *                   $ref: '#/components/schemas/TemplateWithContent'
 *       404:
 *         description: Template not found
 */
const getProposalTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[template]] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const html_content = await loadTemplateFile(template.file_path);
    res.json({ template: { ...template, html_content } });
  } catch (error) {
    console.error('Get proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/proposals:
 *   post:
 *     summary: Create a proposal template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateInput'
 *     responses:
 *       201:
 *         description: Template created - html_content saved to file
 *       400:
 *         description: Validation error
 */
const createProposalTemplate = async (req, res) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Insert row without html_content to get the auto-increment id first
    const [result] = await pool.execute(
      `INSERT INTO proposal_templates (name, description, variables, created_by)
       VALUES (?, ?, ?, ?)`,
      [value.name, value.description || null, value.variables || null, req.user.id]
    );

    const templateId = result.insertId;

    // Write html to file, named after the DB id
    const filePath = await saveTemplateFile('proposals', templateId, value.html_content);

    // Store the file path
    await pool.execute(
      'UPDATE proposal_templates SET file_path = ? WHERE id = ?',
      [filePath, templateId]
    );

    const [[template]] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [templateId]
    );

    res.status(201).json({ template: { ...template, html_content: value.html_content } });
  } catch (error) {
    console.error('Create proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/proposals/{id}:
 *   put:
 *     summary: Update a proposal template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateInput'
 *     responses:
 *       200:
 *         description: Template updated - file overwritten
 *       404:
 *         description: Template not found
 */
const updateProposalTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const [[existing]] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    // Overwrite the existing file (keep same path)
    await saveTemplateFile('proposals', id, value.html_content);

    await pool.execute(
      `UPDATE proposal_templates SET name = ?, description = ?, variables = ? WHERE id = ?`,
      [value.name, value.description || null, value.variables || null, id]
    );

    const [[template]] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [id]
    );

    res.json({ template: { ...template, html_content: value.html_content } });
  } catch (error) {
    console.error('Update proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/proposals/{id}:
 *   delete:
 *     summary: Delete a proposal template and its HTML file
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template deleted
 *       400:
 *         description: Template is in use
 *       404:
 *         description: Template not found
 */
const deleteProposalTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const [proposals] = await pool.execute(
      'SELECT id FROM proposals WHERE template_id = ? LIMIT 1',
      [id]
    );
    if (proposals.length > 0) {
      return res.status(400).json({ error: 'Cannot delete template that is used in proposals' });
    }

    const [[template]] = await pool.execute(
      'SELECT file_path FROM proposal_templates WHERE id = ?',
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM proposal_templates WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template not found' });

    if (template?.file_path) await deleteTemplateFile(template.file_path);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Invoice Templates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/templates/invoices:
 *   get:
 *     summary: List all invoice templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of invoice template metadata
 */
const getInvoiceTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT it.id, it.name, it.description, it.file_path, it.variables,
              it.created_by, it.created_at, it.updated_at,
              u.name AS created_by_name
       FROM invoice_templates it
       LEFT JOIN users u ON it.created_by = u.id
       ORDER BY it.created_at DESC`
    );
    res.json({ templates });
  } catch (error) {
    console.error('Get invoice templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/invoices/{id}:
 *   get:
 *     summary: Get an invoice template by ID (includes html_content from file)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template metadata + html_content
 *       404:
 *         description: Template not found
 */
const getInvoiceTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[template]] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const html_content = await loadTemplateFile(template.file_path);
    res.json({ template: { ...template, html_content } });
  } catch (error) {
    console.error('Get invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/invoices:
 *   post:
 *     summary: Create an invoice template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateInput'
 *     responses:
 *       201:
 *         description: Template created
 */
const createInvoiceTemplate = async (req, res) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const [result] = await pool.execute(
      `INSERT INTO invoice_templates (name, description, variables, created_by)
       VALUES (?, ?, ?, ?)`,
      [value.name, value.description || null, value.variables || null, req.user.id]
    );

    const templateId = result.insertId;
    const filePath = await saveTemplateFile('invoices', templateId, value.html_content);

    await pool.execute(
      'UPDATE invoice_templates SET file_path = ? WHERE id = ?',
      [filePath, templateId]
    );

    const [[template]] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [templateId]
    );

    res.status(201).json({ template: { ...template, html_content: value.html_content } });
  } catch (error) {
    console.error('Create invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/invoices/{id}:
 *   put:
 *     summary: Update an invoice template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateInput'
 *     responses:
 *       200:
 *         description: Template updated
 *       404:
 *         description: Template not found
 */
const updateInvoiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const [[existing]] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await saveTemplateFile('invoices', id, value.html_content);

    await pool.execute(
      `UPDATE invoice_templates SET name = ?, description = ?, variables = ? WHERE id = ?`,
      [value.name, value.description || null, value.variables || null, id]
    );

    const [[template]] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [id]
    );

    res.json({ template: { ...template, html_content: value.html_content } });
  } catch (error) {
    console.error('Update invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/invoices/{id}:
 *   delete:
 *     summary: Delete an invoice template and its HTML file
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template deleted
 *       400:
 *         description: Template is in use
 */
const deleteInvoiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoices] = await pool.execute(
      'SELECT id FROM invoices WHERE template_id = ? LIMIT 1',
      [id]
    );
    if (invoices.length > 0) {
      return res.status(400).json({ error: 'Cannot delete template that is used in invoices' });
    }

    const [[template]] = await pool.execute(
      'SELECT file_path FROM invoice_templates WHERE id = ?',
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM invoice_templates WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template not found' });

    if (template?.file_path) await deleteTemplateFile(template.file_path);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Design Document Templates  (already file-based - unchanged)
// ═══════════════════════════════════════════════════════════════════════════

const getDesignDocumentTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT ddt.*, u.name as created_by_name
       FROM design_document_templates ddt
       LEFT JOIN users u ON ddt.created_by = u.id
       ORDER BY ddt.created_at DESC`
    );
    res.json({ templates });
  } catch (error) {
    console.error('Get design document templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDesignDocumentTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [templates] = await pool.execute(
      'SELECT * FROM design_document_templates WHERE id = ?',
      [id]
    );
    if (templates.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Get design document template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createDesignDocumentTemplate = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { error, value } = designDocumentTemplateSchema.validate(req.body);
    if (error) {
      const fs = require('fs').promises;
      if (req.file.path) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO design_document_templates (name, description, file_path, created_by)
       VALUES (?, ?, ?, ?)`,
      [value.name, value.description || null, req.file.path, req.user.id]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM design_document_templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ template: templates[0] });
  } catch (error) {
    console.error('Create design document template error:', error);
    if (req.file?.path) {
      const fs = require('fs').promises;
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDesignDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = designDocumentTemplateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const [existing] = await pool.execute(
      'SELECT file_path FROM design_document_templates WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Template not found' });

    let filePath = existing[0].file_path;

    if (req.file) {
      const fs = require('fs').promises;
      if (existing[0].file_path) await fs.unlink(existing[0].file_path).catch(() => {});
      filePath = req.file.path;
    }

    await pool.execute(
      `UPDATE design_document_templates SET name = ?, description = ?, file_path = ? WHERE id = ?`,
      [value.name, value.description || null, filePath, id]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM design_document_templates WHERE id = ?',
      [id]
    );

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Update design document template error:', error);
    if (req.file?.path) {
      const fs = require('fs').promises;
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteDesignDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.execute(
      'SELECT id FROM design_documents WHERE template_id = ? LIMIT 1',
      [id]
    );
    if (documents.length > 0) {
      return res.status(400).json({ error: 'Cannot delete template that is used in design documents' });
    }

    const [templates] = await pool.execute(
      'SELECT file_path FROM design_document_templates WHERE id = ?',
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM design_document_templates WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template not found' });

    if (templates[0]?.file_path) {
      const fs = require('fs').promises;
      await fs.unlink(templates[0].file_path).catch(() => {});
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete design document template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Service Agreement Templates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/templates/service-agreements:
 *   get:
 *     summary: List all service agreement templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of service agreement template metadata
 */
const getServiceAgreementTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT sat.id, sat.name, sat.description, sat.file_path, sat.variables,
              sat.created_by, sat.created_at, sat.updated_at,
              u.name AS created_by_name
       FROM service_agreement_templates sat
       LEFT JOIN users u ON sat.created_by = u.id
       ORDER BY sat.created_at DESC`
    );
    res.json({ templates });
  } catch (error) {
    console.error('Get service agreement templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/service-agreements/{id}:
 *   get:
 *     summary: Get a service agreement template by ID (includes html_content from file)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template metadata + html_content
 *       404:
 *         description: Template not found
 */
const getServiceAgreementTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[template]] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [id]
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const html_content = await loadTemplateFile(template.file_path);
    res.json({ template: { ...template, html_content } });
  } catch (error) {
    console.error('Get service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/service-agreements:
 *   post:
 *     summary: Create a service agreement template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateInput'
 *     responses:
 *       201:
 *         description: Template created
 */
const createServiceAgreementTemplate = async (req, res) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const [result] = await pool.execute(
      `INSERT INTO service_agreement_templates (name, description, variables, created_by)
       VALUES (?, ?, ?, ?)`,
      [value.name, value.description || null, value.variables || null, req.user.id]
    );

    const templateId = result.insertId;
    const filePath = await saveTemplateFile('service-agreements', templateId, value.html_content);

    await pool.execute(
      'UPDATE service_agreement_templates SET file_path = ? WHERE id = ?',
      [filePath, templateId]
    );

    const [[template]] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [templateId]
    );

    res.status(201).json({ template: { ...template, html_content: value.html_content } });
  } catch (error) {
    console.error('Create service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/service-agreements/{id}:
 *   put:
 *     summary: Update a service agreement template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateInput'
 *     responses:
 *       200:
 *         description: Template updated
 *       404:
 *         description: Template not found
 */
const updateServiceAgreementTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const [[existing]] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await saveTemplateFile('service-agreements', id, value.html_content);

    await pool.execute(
      `UPDATE service_agreement_templates SET name = ?, description = ?, variables = ? WHERE id = ?`,
      [value.name, value.description || null, value.variables || null, id]
    );

    const [[template]] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [id]
    );

    res.json({ template: { ...template, html_content: value.html_content } });
  } catch (error) {
    console.error('Update service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/templates/service-agreements/{id}:
 *   delete:
 *     summary: Delete a service agreement template and its HTML file
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template deleted
 *       400:
 *         description: Template is in use
 */
const deleteServiceAgreementTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const [agreements] = await pool.execute(
      'SELECT id FROM service_agreements WHERE template_id = ? LIMIT 1',
      [id]
    );
    if (agreements.length > 0) {
      return res.status(400).json({ error: 'Cannot delete template that is used in service agreements' });
    }

    const [[template]] = await pool.execute(
      'SELECT file_path FROM service_agreement_templates WHERE id = ?',
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM service_agreement_templates WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template not found' });

    if (template?.file_path) await deleteTemplateFile(template.file_path);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Shared Swagger component schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * components:
 *   schemas:
 *     TemplateInput:
 *       type: object
 *       required:
 *         - name
 *         - html_content
 *       properties:
 *         name:
 *           type: string
 *           example: "Standard Proposal"
 *         description:
 *           type: string
 *         html_content:
 *           type: string
 *           description: Full HTML with {{variable}} placeholders - saved to disk, not stored in DB
 *         variables:
 *           type: string
 *           description: JSON array of available variable names
 *           example: '["customer.name","proposal.total_amount"]'
 *     TemplateMetadata:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         file_path:
 *           type: string
 *           description: Absolute server path to the .html template file
 *         variables:
 *           type: string
 *         created_by:
 *           type: integer
 *         created_by_name:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     TemplateWithContent:
 *       allOf:
 *         - $ref: '#/components/schemas/TemplateMetadata'
 *         - type: object
 *           properties:
 *             html_content:
 *               type: string
 *               description: Full HTML loaded from the template file
 */

module.exports = {
  getProposalTemplates,
  getProposalTemplateById,
  createProposalTemplate,
  updateProposalTemplate,
  deleteProposalTemplate,
  getInvoiceTemplates,
  getInvoiceTemplateById,
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  getDesignDocumentTemplates,
  getDesignDocumentTemplateById,
  createDesignDocumentTemplate,
  updateDesignDocumentTemplate,
  deleteDesignDocumentTemplate,
  getServiceAgreementTemplates,
  getServiceAgreementTemplateById,
  createServiceAgreementTemplate,
  updateServiceAgreementTemplate,
  deleteServiceAgreementTemplate,
};
