const pool = require("../config/database");
const Joi = require("joi");
const path = require("path");
const fs = require("fs");
const { sendPORequestEmail, sendPOReceivedEmail } = require("../services/emailService");

const projectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow("", null),
  client_id: Joi.number().integer().required(),
  service_id: Joi.number().integer().allow(null),
  phase: Joi.string()
    .valid(
      "draft",
      "submitted",
      "accepted",
      "rejected",
      "kickoff",
      "in progress",
      "on hold",
      "cancelled",
      "completed",
      "support",
      "closed"
    )
    .default("draft"),
  currency: Joi.string().default('LKR'),
  total_amount: Joi.number().min(0).default(0),
  status: Joi.string()
    .valid("active", "completed", "cancelled")
    .default("active"),
  start_date: Joi.date().allow(null),
  end_date: Joi.date().allow(null),
  has_recurring_billing: Joi.boolean().default(false),
  free_support_period_months: Joi.number().integer().min(0).default(0),
});

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 */
const getProjects = async (req, res) => {
  try {
    const [projects] = await pool.execute(
      `SELECT p.*, cl.company_name AS client_name,
       cc.name AS contact_name, cc.email AS contact_email,
       s.name as service_name
       FROM projects p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN services s ON p.service_id = s.id
       ORDER BY p.created_at DESC`
    );
    res.json({ projects });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project details with proposals, invoices, and payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 project:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     phase:
 *                       type: string
 *                       enum: ["draft", "submitted", "accepted", "rejected", "kickoff", "in progress", "on hold", "cancelled", "completed", "support", "closed"]
 *                     status:
 *                       type: string
 *                       enum: ["active", "completed", "cancelled"]
 *                 proposals:
 *                   type: array
 *                 invoices:
 *                   type: array
 *                 payments:
 *                   type: array
 *                 payment_summary:
 *                   type: object
 *       404:
 *         description: Project not found
 */
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const [projects] = await pool.execute(
      `SELECT p.*, cl.company_name AS client_name,
       cc.name AS contact_name, cc.email AS contact_email,
       s.name as service_name
       FROM projects p
       LEFT JOIN clients cl ON p.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN services s ON p.service_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get linked proposals with full details
    const [proposals] = await pool.execute(
      `SELECT p.id, p.proposal_number, p.total_amount, p.currency, p.status, p.valid_until, p.subject, p.created_at, p.pdf_path, p.source
       FROM proposals p
       WHERE p.project_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );

    // Get linked invoices with full details
    const [invoices] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.final_amount, i.currency, i.status, i.due_date, i.subject, i.created_at, i.pdf_path
       FROM invoices i
       WHERE i.project_id = ?
       ORDER BY i.created_at DESC`,
      [id]
    );

    // Get linked service agreements
    const [serviceAgreements] = await pool.execute(
      `SELECT id, agreement_number, subject, status, pdf_path, created_at
       FROM service_agreements
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    // Get linked design documents
    const [designDocuments] = await pool.execute(
      `SELECT id, document_number, subject, status, file_path, notes, created_at
       FROM design_documents
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    // Get payments - includes both direct project payments and invoice-linked payments
    const [payments] = await pool.execute(
      `SELECT p.*, i.invoice_number, ps.stage_name
       FROM payments p
       LEFT JOIN invoices i ON p.invoice_id = i.id
       LEFT JOIN payment_stages ps ON i.payment_stage_id = ps.id
       WHERE p.project_id = ? OR (p.invoice_id IS NOT NULL AND i.project_id = ?)
       ORDER BY p.payment_date DESC`,
      [id, id]
    );

    // Get payment stages through linked proposals, with invoice info and dynamic overdue status
    const [paymentStages] = await pool.execute(
      `SELECT
         ps.id, ps.stage_name, ps.percentage, ps.amount, ps.due_date,
         CASE
           WHEN ps.status = 'paid' THEN 'paid'
           WHEN ps.due_date IS NOT NULL AND ps.due_date < CURDATE() AND ps.status != 'paid' THEN 'overdue'
           ELSE 'pending'
         END AS status,
         p.id AS proposal_id, p.proposal_number, p.currency,
         i.id AS invoice_id, i.invoice_number, i.status AS invoice_status, i.final_amount AS invoice_amount
       FROM payment_stages ps
       JOIN proposals p ON p.id = ps.proposal_id
       LEFT JOIN invoices i ON i.payment_stage_id = ps.id
       WHERE p.project_id = ?
       ORDER BY ps.id ASC`,
      [id]
    );

    // Calculate payment totals.
    // broker_commission and developer_payment are outgoing costs - they must NOT
    // count toward the customer-paid total or reduce the project balance.
    const brokerPayments = payments
      .filter((p) => p.payment_type === 'broker_commission')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const developerPayments = payments
      .filter((p) => p.payment_type === 'developer_payment')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalPaid = payments
      .filter((p) => p.payment_type !== 'broker_commission' && p.payment_type !== 'developer_payment')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
      project: projects[0],
      proposals,
      invoices,
      service_agreements: serviceAgreements,
      design_documents: designDocuments,
      payments,
      payment_stages: paymentStages,
      payment_summary: {
        total_amount: parseFloat(projects[0].total_amount),
        total_paid: totalPaid,
        broker_payments: brokerPayments,
        developer_payments: developerPayments,
        remaining: parseFloat(projects[0].total_amount) - totalPaid,
      },
    });
  } catch (error) {
    console.error("Get project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - customer_id
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               customer_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *               phase:
 *                 type: string
 *                 enum: ["draft", "submitted", "accepted", "rejected", "kickoff", "in progress", "on hold", "cancelled", "completed", "support", "closed"]
 *               total_amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: ["active", "completed", "cancelled"]
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               has_recurring_billing:
 *                 type: boolean
 *               free_support_period_months:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation error
 */
const createProject = async (req, res) => {
  try {
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO projects (name, description, client_id, service_id, phase, currency, total_amount, status, start_date, end_date, has_recurring_billing, free_support_period_months, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        value.name,
        value.description || null,
        value.client_id,
        value.service_id || null,
        value.phase,
        value.currency,
        value.total_amount,
        value.status,
        value.start_date || null,
        value.end_date || null,
        value.has_recurring_billing || false,
        value.free_support_period_months || 0,
        req.user.id,
      ]
    );

    const [projects] = await pool.execute(
      "SELECT * FROM projects WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({ project: projects[0] });
  } catch (error) {
    console.error("Create project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
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
 *             type: object
 *             required:
 *               - name
 *               - customer_id
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               customer_id:
 *                 type: integer
 *               service_id:
 *                 type: integer
 *               phase:
 *                 type: string
 *                 enum: ["draft", "submitted", "accepted", "rejected", "kickoff", "in progress", "on hold", "cancelled", "completed", "support", "closed"]
 *               total_amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: ["active", "completed", "cancelled"]
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               has_recurring_billing:
 *                 type: boolean
 *               free_support_period_months:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Project not found
 */
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = projectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE projects
       SET name = ?, description = ?, client_id = ?, service_id = ?, phase = ?,
       currency = ?, total_amount = ?, status = ?, start_date = ?, end_date = ?,
       has_recurring_billing = ?, free_support_period_months = ?
       WHERE id = ?`,
      [
        value.name,
        value.description || null,
        value.client_id,
        value.service_id || null,
        value.phase,
        value.currency,
        value.total_amount,
        value.status,
        value.start_date || null,
        value.end_date || null,
        value.has_recurring_billing || false,
        value.free_support_period_months || 0,
        id,
      ]
    );

    const [projects] = await pool.execute(
      "SELECT * FROM projects WHERE id = ?",
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ project: projects[0] });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/projects/{id}/phase:
 *   put:
 *     summary: Update project phase
 *     tags: [Projects]
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
 *             type: object
 *             required:
 *               - phase
 *             properties:
 *               phase:
 *                 type: string
 *                 enum: ["draft", "submitted", "accepted", "rejected", "kickoff", "in progress", "on hold", "cancelled", "completed", "support", "closed"]
 *                 example: "accepted"
 *                 description: |
 *                   Project phase. Valid values:
 *                   - draft: Initial project draft
 *                   - submitted: Project proposal submitted
 *                   - accepted: Project proposal accepted
 *                   - rejected: Project proposal rejected
 *                   - kickoff: Project kickoff started
 *                   - in progress: Project in active development
 *                   - on hold: Project temporarily paused
 *                   - cancelled: Project cancelled
 *                   - completed: Project completed
 *                   - support: Project in support/maintenance phase
 *                   - closed: Project closed
 *     responses:
 *       200:
 *         description: Project phase updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 project:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     phase:
 *                       type: string
 *       400:
 *         description: Invalid phase
 *       404:
 *         description: Project not found
 */
const updateProjectPhase = async (req, res) => {
  try {
    const { id } = req.params;
    const { phase } = req.body;

    const validPhases = [
      "draft",
      "submitted",
      "accepted",
      "rejected",
      "kickoff",
      "in progress",
      "on hold",
      "cancelled",
      "completed",
      "support",
      "closed",
    ];
    
    if (!validPhases.includes(phase)) {
      return res.status(400).json({ error: "Invalid phase" });
    }

    await pool.execute("UPDATE projects SET phase = ? WHERE id = ?", [
      phase,
      id,
    ]);

    const [projects] = await pool.execute(
      "SELECT * FROM projects WHERE id = ?",
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ project: projects[0] });
  } catch (error) {
    console.error("Update project phase error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
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
 *         description: Project deleted successfully
 *       400:
 *         description: Cannot delete project with associated invoices or proposals
 *       404:
 *         description: Project not found
 */
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify project exists first
    const [[project]] = await pool.execute(
      "SELECT id FROM projects WHERE id = ?", [id]
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Check all tables that reference project_id with RESTRICT / hard dependency
    const [invoices] = await pool.execute(
      "SELECT id FROM invoices WHERE project_id = ? LIMIT 1", [id]
    );
    const [proposals] = await pool.execute(
      "SELECT id FROM proposals WHERE project_id = ? LIMIT 1", [id]
    );
    const [recurringBills] = await pool.execute(
      "SELECT id FROM recurring_bills WHERE project_id = ? LIMIT 1", [id]
    );
    const [payments] = await pool.execute(
      "SELECT id FROM payments WHERE project_id = ? LIMIT 1", [id]
    );

    const blocked = [];
    if (invoices.length)       blocked.push("invoices");
    if (proposals.length)      blocked.push("proposals");
    if (recurringBills.length) blocked.push("recurring bills");
    if (payments.length)       blocked.push("payments");

    if (blocked.length > 0) {
      return res.status(409).json({
        error: `Cannot delete project - it has linked ${blocked.join(", ")}. Remove or reassign them first.`,
        blocked,
      });
    }

    await pool.execute("DELETE FROM projects WHERE id = ?", [id]);
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const uploadPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const [[project]] = await pool.execute(
      `SELECT proj.id, proj.name,
       cc.name AS contact_name, cc.email AS contact_email,
       cl.company_name AS client_name,
       p.proposal_number
       FROM projects proj
       LEFT JOIN clients cl ON proj.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN proposals p ON p.project_id = proj.id AND p.status = 'accepted'
       WHERE proj.id = ?
       LIMIT 1`,
      [id]
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const filePath = `/uploads/purchase-orders/${req.file.filename}`;

    await pool.execute(
      "UPDATE projects SET purchase_order_url = ?, purchase_order_received_at = NOW() WHERE id = ?",
      [filePath, id]
    );

    const [[updated]] = await pool.execute("SELECT * FROM projects WHERE id = ?", [id]);

    // Notify the customer that their PO was received - fire-and-forget
    if (project.contact_email) {
      sendPOReceivedEmail(
        project.contact_email,
        project.contact_name || project.client_name,
        project.name,
        project.proposal_number || 'N/A'
      ).catch((err) => console.error('[Email] PO received email failed:', err.message));
    }

    res.json({ project: updated, message: "Purchase order uploaded successfully" });
  } catch (error) {
    console.error("Upload purchase order error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const removePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const [[project]] = await pool.execute(
      "SELECT purchase_order_url FROM projects WHERE id = ?", [id]
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Delete file from disk if it exists
    if (project.purchase_order_url) {
      const filePath = path.join(__dirname, "../../", project.purchase_order_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.execute(
      "UPDATE projects SET purchase_order_url = NULL, purchase_order_received_at = NULL WHERE id = ?",
      [id]
    );

    res.json({ message: "Purchase order removed successfully" });
  } catch (error) {
    console.error("Remove purchase order error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getFinancialsSummary = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        proj.id, proj.name, proj.status, proj.phase,
        c.company_name AS client_name,
        COALESCE((
          SELECT SUM(p.amount) FROM payments p
          LEFT JOIN invoices i ON p.invoice_id = i.id
          WHERE (p.project_id = proj.id OR i.project_id = proj.id)
            AND p.recipient_type = 'company'
        ), 0) AS total_in,
        COALESCE((
          SELECT SUM(p.amount) FROM payments p
          LEFT JOIN invoices i ON p.invoice_id = i.id
          WHERE (p.project_id = proj.id OR i.project_id = proj.id)
            AND p.recipient_type != 'company'
        ), 0) AS total_out,
        COALESCE((
          SELECT COUNT(p.id) FROM payments p
          LEFT JOIN invoices i ON p.invoice_id = i.id
          WHERE p.project_id = proj.id OR i.project_id = proj.id
        ), 0) AS transaction_count
      FROM projects proj
      LEFT JOIN clients c ON c.id = proj.client_id
      WHERE proj.status != 'cancelled'
      ORDER BY proj.created_at DESC
    `);
    res.json({ projects: rows.map(r => ({ ...r, net: parseFloat(r.total_in) - parseFloat(r.total_out) })) });
  } catch (error) {
    console.error('Get financials summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const sendPORequestEmailToCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const [[project]] = await pool.execute(
      `SELECT proj.*, cl.company_name AS client_name,
       cc.name AS contact_name, cc.email AS contact_email,
       p.proposal_number
       FROM projects proj
       LEFT JOIN clients cl ON proj.client_id = cl.id
       LEFT JOIN client_contacts cc ON cc.client_id = cl.id AND cc.is_primary = TRUE
       LEFT JOIN proposals p ON p.project_id = proj.id AND p.status = 'accepted'
       WHERE proj.id = ?
       LIMIT 1`,
      [id]
    );

    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.contact_email) return res.status(400).json({ error: 'No contact email' });

    await sendPORequestEmail(
      project.contact_email,
      project.contact_name || project.client_name,
      project.name,
      project.proposal_number || 'N/A'
    );

    res.json({ message: 'PO request email sent successfully' });
  } catch (error) {
    console.error('Send PO request email error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  getFinancialsSummary,
  createProject,
  updateProject,
  updateProjectPhase,
  deleteProject,
  uploadPurchaseOrder,
  sendPORequestEmailToCustomer,
  removePurchaseOrder,
};
