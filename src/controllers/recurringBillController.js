const pool = require("../config/database");
const Joi = require("joi");

const recurringBillSchema = Joi.object({
  project_id:       Joi.number().integer().required(),
  client_id:        Joi.number().integer().required(),
  service_id:       Joi.number().integer().allow(null),
  amount:           Joi.number().positive().required(),
  frequency:        Joi.string().valid("monthly", "annually").required(),
  start_date:       Joi.date().required(),
  end_date:         Joi.date().allow(null),
  next_billing_date:Joi.date().required(),
  status:           Joi.string().valid("active", "paused", "cancelled").default("active"),
  auto_generate:    Joi.boolean().default(true),
});

const BILL_SELECT = `
  SELECT rb.*,
         cl.company_name AS client_name,
         p.name          AS project_name,
         s.name          AS service_name
  FROM recurring_bills rb
  LEFT JOIN clients   cl ON rb.client_id  = cl.id
  LEFT JOIN projects  p  ON rb.project_id = p.id
  LEFT JOIN services  s  ON rb.service_id = s.id`;

const getRecurringBills = async (req, res) => {
  try {
    const { status, client_id, project_id } = req.query;
    let query = BILL_SELECT + " WHERE 1=1";
    const params = [];

    if (status)     { query += " AND rb.status = ?";     params.push(status);     }
    if (client_id)  { query += " AND rb.client_id = ?";  params.push(client_id);  }
    if (project_id) { query += " AND rb.project_id = ?"; params.push(project_id); }

    query += " ORDER BY rb.next_billing_date ASC";

    const [bills] = await pool.execute(query, params);
    res.json({ recurring_bills: bills });
  } catch (error) {
    console.error("Get recurring bills error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getRecurringBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const [bills] = await pool.execute(BILL_SELECT + " WHERE rb.id = ?", [id]);

    if (bills.length === 0) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }

    res.json({ recurring_bill: bills[0] });
  } catch (error) {
    console.error("Get recurring bill error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createRecurringBill = async (req, res) => {
  try {
    const { error, value } = recurringBillSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [[project]] = await pool.execute(
      "SELECT id FROM projects WHERE id = ?", [value.project_id]
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const [[client]] = await pool.execute(
      "SELECT id FROM clients WHERE id = ?", [value.client_id]
    );
    if (!client) return res.status(404).json({ error: "Client not found" });

    const [result] = await pool.execute(
      `INSERT INTO recurring_bills
         (project_id, client_id, service_id, amount, frequency,
          start_date, end_date, next_billing_date, status, auto_generate, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        value.project_id, value.client_id, value.service_id || null,
        value.amount, value.frequency, value.start_date, value.end_date || null,
        value.next_billing_date, value.status, value.auto_generate, req.user.id,
      ]
    );

    const [bills] = await pool.execute(BILL_SELECT + " WHERE rb.id = ?", [result.insertId]);
    res.status(201).json({ recurring_bill: bills[0] });
  } catch (error) {
    console.error("Create recurring bill error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateRecurringBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = recurringBillSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE recurring_bills
       SET project_id = ?, client_id = ?, service_id = ?, amount = ?, frequency = ?,
           start_date = ?, end_date = ?, next_billing_date = ?, status = ?, auto_generate = ?
       WHERE id = ?`,
      [
        value.project_id, value.client_id, value.service_id || null,
        value.amount, value.frequency, value.start_date, value.end_date || null,
        value.next_billing_date, value.status, value.auto_generate, id,
      ]
    );

    const [bills] = await pool.execute(BILL_SELECT + " WHERE rb.id = ?", [id]);
    if (bills.length === 0) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }

    res.json({ recurring_bill: bills[0] });
  } catch (error) {
    console.error("Update recurring bill error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteRecurringBill = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute("DELETE FROM recurring_bills WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Recurring bill not found" });
    }

    res.json({ message: "Recurring bill deleted successfully" });
  } catch (error) {
    console.error("Delete recurring bill error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getRecurringBills,
  getRecurringBillById,
  createRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
};
