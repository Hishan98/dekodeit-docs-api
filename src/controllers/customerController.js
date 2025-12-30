const pool = require("../config/database");
const Joi = require("joi");

const customerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().allow("", null),
  phone: Joi.string()
    .allow("", null)
    .custom((value, helpers) => {
      if (!value) return value;
      const digits = value.replace(/\D/g, "");
      if (digits.length > 13) {
        return helpers.error("any.invalid");
      }
      return value;
    }, "phone max 13 digits validation")
    .messages({
      "any.invalid":
        "Phone number must have at most 13 digits including country code",
    }),
  company: Joi.string().allow("", null),
  address: Joi.string().allow("", null),
  vat_id: Joi.string().allow("", null),
  notes: Joi.string().allow("", null),
});

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       company:
 *                         type: string
 *                       address:
 *                         type: string
 *                       vat_id:
 *                         type: string
 *                       notes:
 *                         type: string
 *                       created_by:
 *                         type: integer
 *                       created_by_name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 */
const getCustomers = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      `SELECT c.*, u.name as created_by_name 
       FROM customers c 
       LEFT JOIN users u ON c.created_by = u.id 
       ORDER BY c.created_at DESC`
    );

    res.json({ customers });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customer:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     company:
 *                       type: string
 *                     address:
 *                       type: string
 *                     vat_id:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     created_by:
 *                       type: integer
 *                     created_by_name:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Customer not found
 */
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const [customers] = await pool.execute(
      `SELECT c.*, u.name as created_by_name 
       FROM customers c 
       LEFT JOIN users u ON c.created_by = u.id 
       WHERE c.id = ?`,
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ customer: customers[0] });
  } catch (error) {
    console.error("Get customer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create customer (Admin only)
 *     tags: [Customers]
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
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 example: "+94 77 123 4567"
 *               company:
 *                 type: string
 *                 example: "ABC Corporation"
 *               address:
 *                 type: string
 *                 example: "123 Business Street, Colombo 05"
 *               vat_id:
 *                 type: string
 *                 example: "VAT001234"
 *               notes:
 *                 type: string
 *                 example: "Regular client"
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Validation error
 */
const createCustomer = async (req, res) => {
  try {
    const { error, value } = customerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO customers (name, email, phone, company, address, vat_id, notes, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        value.name,
        value.email || null,
        value.phone || null,
        value.company || null,
        value.address || null,
        value.vat_id || null,
        value.notes || null,
        req.user.id,
      ]
    );

    const [customers] = await pool.execute(
      "SELECT * FROM customers WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({ customer: customers[0] });
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Update customer (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 example: "+94 77 123 4567"
 *               company:
 *                 type: string
 *                 example: "ABC Corporation"
 *               address:
 *                 type: string
 *                 example: "123 Business Street, Colombo 05"
 *               vat_id:
 *                 type: string
 *                 example: "VAT001234"
 *               notes:
 *                 type: string
 *                 example: "Regular client"
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Customer not found
 */
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = customerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE customers 
       SET name = ?, email = ?, phone = ?, company = ?, address = ?, vat_id = ?, notes = ? 
       WHERE id = ?`,
      [
        value.name,
        value.email || null,
        value.phone || null,
        value.company || null,
        value.address || null,
        value.vat_id || null,
        value.notes || null,
        id,
      ]
    );

    const [customers] = await pool.execute(
      "SELECT * FROM customers WHERE id = ?",
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ customer: customers[0] });
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete customer (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer has associated invoices or proposals
    const [invoices] = await pool.execute(
      "SELECT id FROM invoices WHERE customer_id = ? LIMIT 1",
      [id]
    );
    const [proposals] = await pool.execute(
      "SELECT id FROM proposals WHERE customer_id = ? LIMIT 1",
      [id]
    );

    if (invoices.length > 0 || proposals.length > 0) {
      return res.status(400).json({
        error: "Cannot delete customer with associated invoices or proposals",
      });
    }

    const [result] = await pool.execute("DELETE FROM customers WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
