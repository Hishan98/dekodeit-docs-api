const pool = require('../config/database');
const Joi = require('joi');

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

// Proposal Templates
const getProposalTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT pt.*, u.name as created_by_name 
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

const getProposalTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [templates] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Get proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createProposalTemplate = async (req, res) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO proposal_templates (name, description, html_content, variables, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        value.name,
        value.description || null,
        value.html_content,
        value.variables || null,
        req.user.id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ template: templates[0] });
  } catch (error) {
    console.error('Create proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProposalTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE proposal_templates 
       SET name = ?, description = ?, html_content = ?, variables = ? 
       WHERE id = ?`,
      [
        value.name,
        value.description || null,
        value.html_content,
        value.variables || null,
        id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM proposal_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Update proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteProposalTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is used
    const [proposals] = await pool.execute(
      'SELECT id FROM proposals WHERE template_id = ? LIMIT 1',
      [id]
    );

    if (proposals.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete template that is used in proposals',
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM proposal_templates WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete proposal template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Invoice Templates
const getInvoiceTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT it.*, u.name as created_by_name 
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

const getInvoiceTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [templates] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Get invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createInvoiceTemplate = async (req, res) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO invoice_templates (name, description, html_content, variables, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        value.name,
        value.description || null,
        value.html_content,
        value.variables || null,
        req.user.id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ template: templates[0] });
  } catch (error) {
    console.error('Create invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateInvoiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE invoice_templates 
       SET name = ?, description = ?, html_content = ?, variables = ? 
       WHERE id = ?`,
      [
        value.name,
        value.description || null,
        value.html_content,
        value.variables || null,
        id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM invoice_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Update invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteInvoiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is used
    const [invoices] = await pool.execute(
      'SELECT id FROM invoices WHERE template_id = ? LIMIT 1',
      [id]
    );

    if (invoices.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete template that is used in invoices',
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM invoice_templates WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete invoice template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Design Document Templates
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

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Get design document template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createDesignDocumentTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const { error, value } = designDocumentTemplateSchema.validate(req.body);
    if (error) {
      // Delete uploaded file if validation fails
      const fs = require('fs').promises;
      if (req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO design_document_templates (name, description, file_path, created_by) 
       VALUES (?, ?, ?, ?)`,
      [
        value.name,
        value.description || null,
        req.file.path,
        req.user.id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM design_document_templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ template: templates[0] });
  } catch (error) {
    console.error('Create design document template error:', error);
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateDesignDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = designDocumentTemplateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Get existing template
    const [existing] = await pool.execute(
      'SELECT file_path FROM design_document_templates WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let filePath = existing[0].file_path;

    // If new file is uploaded, replace the old one
    if (req.file) {
      // Delete old file
      const fs = require('fs').promises;
      if (existing[0].file_path) {
        try {
          await fs.unlink(existing[0].file_path);
        } catch (unlinkError) {
          console.error('Error deleting old file:', unlinkError);
        }
      }
      filePath = req.file.path;
    }

    await pool.execute(
      `UPDATE design_document_templates 
       SET name = ?, description = ?, file_path = ? 
       WHERE id = ?`,
      [
        value.name,
        value.description || null,
        filePath,
        id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM design_document_templates WHERE id = ?',
      [id]
    );

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Update design document template error:', error);
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteDesignDocumentTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is used
    const [documents] = await pool.execute(
      'SELECT id FROM design_documents WHERE template_id = ? LIMIT 1',
      [id]
    );

    if (documents.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete template that is used in design documents',
      });
    }

    // Get file path before deleting
    const [templates] = await pool.execute(
      'SELECT file_path FROM design_document_templates WHERE id = ?',
      [id]
    );

    const [result] = await pool.execute(
      'DELETE FROM design_document_templates WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Delete file
    if (templates.length > 0 && templates[0].file_path) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(templates[0].file_path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete design document template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Service Agreement Templates
const getServiceAgreementTemplates = async (req, res) => {
  try {
    const [templates] = await pool.execute(
      `SELECT sat.*, u.name as created_by_name 
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

const getServiceAgreementTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [templates] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Get service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createServiceAgreementTemplate = async (req, res) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO service_agreement_templates (name, description, html_content, variables, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        value.name,
        value.description || null,
        value.html_content,
        value.variables || null,
        req.user.id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ template: templates[0] });
  } catch (error) {
    console.error('Create service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateServiceAgreementTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE service_agreement_templates 
       SET name = ?, description = ?, html_content = ?, variables = ? 
       WHERE id = ?`,
      [
        value.name,
        value.description || null,
        value.html_content,
        value.variables || null,
        id,
      ]
    );

    const [templates] = await pool.execute(
      'SELECT * FROM service_agreement_templates WHERE id = ?',
      [id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: templates[0] });
  } catch (error) {
    console.error('Update service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteServiceAgreementTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is used
    const [agreements] = await pool.execute(
      'SELECT id FROM service_agreements WHERE template_id = ? LIMIT 1',
      [id]
    );

    if (agreements.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete template that is used in service agreements',
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM service_agreement_templates WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete service agreement template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

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

