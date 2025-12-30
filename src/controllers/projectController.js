const pool = require("../config/database");
const Joi = require("joi");

const projectSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow("", null),
  customer_id: Joi.number().integer().required(),
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
      `SELECT p.*, c.name as customer_name, c.email as customer_email,
       s.name as service_name
       FROM projects p
       LEFT JOIN customers c ON p.customer_id = c.id
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
      `SELECT p.*, c.name as customer_name, c.email as customer_email,
       s.name as service_name
       FROM projects p
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN services s ON p.service_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Get linked proposals with full details
    const [proposals] = await pool.execute(
      `SELECT p.id, p.proposal_number, p.total_amount, p.currency, p.status, p.valid_until, p.subject, p.created_at, p.pdf_path
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

    // Get payments
    const [payments] = await pool.execute(
      `SELECT * FROM payments WHERE project_id = ? ORDER BY payment_date DESC`,
      [id]
    );

    // Calculate payment totals
    const totalPaid = payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );
    const brokerPayments = payments
      .filter((p) => p.payment_type === "broker_commission")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const developerPayments = payments
      .filter((p) => p.payment_type === "developer_payment")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
      project: projects[0],
      proposals,
      invoices,
      payments,
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
      `INSERT INTO projects (name, description, customer_id, service_id, phase, total_amount, status, start_date, end_date, has_recurring_billing, free_support_period_months, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        value.name,
        value.description || null,
        value.customer_id,
        value.service_id || null,
        value.phase,
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
       SET name = ?, description = ?, customer_id = ?, service_id = ?, phase = ?,
       total_amount = ?, status = ?, start_date = ?, end_date = ?, has_recurring_billing = ?, free_support_period_months = ?
       WHERE id = ?`,
      [
        value.name,
        value.description || null,
        value.customer_id,
        value.service_id || null,
        value.phase,
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

    // Check if project has associated invoices or proposals
    const [invoices] = await pool.execute(
      "SELECT id FROM invoices WHERE project_id = ? LIMIT 1",
      [id]
    );
    const [proposals] = await pool.execute(
      "SELECT id FROM proposals WHERE project_id = ? LIMIT 1",
      [id]
    );

    if (invoices.length > 0 || proposals.length > 0) {
      return res.status(400).json({
        error: "Cannot delete project with associated invoices or proposals",
      });
    }

    const [result] = await pool.execute("DELETE FROM projects WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  updateProjectPhase,
  deleteProject,
};
