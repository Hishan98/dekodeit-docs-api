const pool = require('../config/database');
const Joi = require('joi');
const { generateDesignDocumentNumber } = require('../services/numberingService');
const path = require('path');
const fs = require('fs').promises;

const designDocumentSchema = Joi.object({
  project_id: Joi.number().integer().required(),
  subject: Joi.string().allow('', null),
  status: Joi.string().valid('draft', 'sent', 'accepted', 'rejected').default('draft'),
  notes: Joi.string().allow('', null),
});

/**
 * @swagger
 * /api/design-documents:
 *   get:
 *     summary: Get all design documents
 *     description: Retrieve a list of all design documents with project and customer information
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of design documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       document_number:
 *                         type: string
 *                         example: "DD250101"
 *                       project_id:
 *                         type: integer
 *                       project_name:
 *                         type: string
 *                       customer_name:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: ["draft", "sent", "accepted", "rejected"]
 *       500:
 *         description: Internal server error
 */
const getDesignDocuments = async (req, res) => {
  try {
    const [documents] = await pool.execute(
      `SELECT dd.*, p.name as project_name, p.client_id,
       cl.company_name as client_name
       FROM design_documents dd
       LEFT JOIN projects p ON dd.project_id = p.id
       LEFT JOIN clients cl ON p.client_id = cl.id
       ORDER BY dd.created_at DESC`
    );
    res.json({ documents });
  } catch (error) {
    console.error('Get design documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/design-documents/{id}:
 *   get:
 *     summary: Get design document by ID
 *     description: Retrieve a specific design document by its ID
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Design document ID
 *     responses:
 *       200:
 *         description: Design document details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document:
 *                   type: object
 *       404:
 *         description: Design document not found
 *       500:
 *         description: Internal server error
 */
const getDesignDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.execute(
      `SELECT dd.*, p.name as project_name, p.client_id,
       cl.company_name as client_name
       FROM design_documents dd
       LEFT JOIN projects p ON dd.project_id = p.id
       LEFT JOIN clients cl ON p.client_id = cl.id
       WHERE dd.id = ?`,
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Design document not found' });
    }

    res.json({ document: documents[0] });
  } catch (error) {
    console.error('Get design document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/design-documents:
 *   post:
 *     summary: Create a new design document
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *               - file
 *             properties:
 *               project_id:
 *                 type: integer
 *               subject:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: ["draft", "sent", "accepted", "rejected"]
 *               notes:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Design document created successfully
 *       400:
 *         description: Validation error
 */
const createDesignDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const { error, value } = designDocumentSchema.validate(req.body);
    if (error) {
      // Delete uploaded file if validation fails
      if (req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      return res.status(400).json({ error: error.details[0].message });
    }

    // Generate document number
    const documentNumber = await generateDesignDocumentNumber();

    // Verify project exists
    const [projects] = await pool.execute(
      'SELECT id FROM projects WHERE id = ?',
      [value.project_id]
    );

    if (projects.length === 0) {
      // Delete uploaded file
      if (req.file.path) {
        await fs.unlink(req.file.path);
      }
      return res.status(404).json({ error: 'Project not found' });
    }

    // Insert design document
    const [result] = await pool.execute(
      `INSERT INTO design_documents (document_number, project_id, subject, file_path, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        documentNumber,
        value.project_id,
        value.subject || null,
        req.file.path,
        value.status,
        value.notes || null,
        req.user.id,
      ]
    );

    const documentId = result.insertId;

    const [documents] = await pool.execute(
      'SELECT * FROM design_documents WHERE id = ?',
      [documentId]
    );

    res.status(201).json({ document: documents[0] });
  } catch (error) {
    console.error('Create design document error:', error);
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/design-documents/{id}:
 *   put:
 *     summary: Update a design document
 *     description: Update a design document. File upload is optional - only upload if replacing the existing file.
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Design document ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - project_id
 *             properties:
 *               project_id:
 *                 type: integer
 *               subject:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: ["draft", "sent", "accepted", "rejected"]
 *               notes:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional - only upload if replacing the existing file
 *     responses:
 *       200:
 *         description: Design document updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Design document not found
 *       500:
 *         description: Internal server error
 */
const updateDesignDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = designDocumentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Get existing document
    const [existing] = await pool.execute(
      'SELECT * FROM design_documents WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Design document not found' });
    }

    let filePath = existing[0].file_path;

    // If new file is uploaded, replace the old one
    if (req.file) {
      // Delete old file
      if (existing[0].file_path) {
        try {
          await fs.unlink(existing[0].file_path);
        } catch (unlinkError) {
          console.error('Error deleting old file:', unlinkError);
        }
      }
      filePath = req.file.path;

      // Regenerate PDF if needed
      // TODO: Implement .docx to PDF conversion
    }

    await pool.execute(
      `UPDATE design_documents 
       SET project_id = ?, subject = ?, file_path = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        value.project_id,
        value.subject || null,
        filePath,
        value.status,
        value.notes || null,
        id,
      ]
    );

    const [documents] = await pool.execute(
      'SELECT * FROM design_documents WHERE id = ?',
      [id]
    );

    res.json({ document: documents[0] });
  } catch (error) {
    console.error('Update design document error:', error);
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/design-documents/{id}:
 *   delete:
 *     summary: Delete a design document
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 */
const deleteDesignDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.execute(
      'SELECT file_path FROM design_documents WHERE id = ?',
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Design document not found' });
    }

    const document = documents[0];

    // Delete file
    if (document.file_path) {
      try {
        await fs.unlink(document.file_path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    await pool.execute('DELETE FROM design_documents WHERE id = ?', [id]);

    res.json({ message: 'Design document deleted successfully' });
  } catch (error) {
    console.error('Delete design document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/design-documents/{id}/download:
 *   get:
 *     summary: Download design document file
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 */
const downloadDesignDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const [documents] = await pool.execute(
      'SELECT file_path, document_number FROM design_documents WHERE id = ?',
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Design document not found' });
    }

    const document = documents[0];

    if (!document.file_path) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file exists
    try {
      await fs.access(document.file_path);
    } catch {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const fileName = `design-document-${document.document_number}${path.extname(document.file_path)}`;
    res.download(document.file_path, fileName);
  } catch (error) {
    console.error('Download design document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @swagger
 * /api/design-documents/{id}/status:
 *   put:
 *     summary: Update design document status only
 *     description: Updates only the status field of a design document without requiring other fields
 *     tags: [Design Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Design document ID
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
 *                 enum: ["draft", "sent", "accepted", "rejected"]
 *                 description: New status for the design document
 *                 example: "sent"
 *     responses:
 *       200:
 *         description: Design document status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     document_number:
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
 *                   example: "Invalid status. Valid values: draft, sent, accepted, rejected"
 *       404:
 *         description: Design document not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Design document not found"
 *       500:
 *         description: Internal server error
 */
const updateDesignDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'sent', 'accepted', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Valid values: draft, sent, accepted, rejected' });
    }

    // Check if document exists
    const [existing] = await pool.execute(
      'SELECT id FROM design_documents WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Design document not found' });
    }

    await pool.execute(
      'UPDATE design_documents SET status = ? WHERE id = ?',
      [status, id]
    );

    const [documents] = await pool.execute(
      'SELECT * FROM design_documents WHERE id = ?',
      [id]
    );

    res.json({ document: documents[0] });
  } catch (error) {
    console.error('Update design document status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDesignDocuments,
  getDesignDocumentById,
  createDesignDocument,
  updateDesignDocument,
  updateDesignDocumentStatus,
  deleteDesignDocument,
  downloadDesignDocument,
};

