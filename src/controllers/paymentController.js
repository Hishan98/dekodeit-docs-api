const pool = require('../config/database');
const Joi = require('joi');
const fs = require('fs');
const path = require('path');

const paymentSchema = Joi.object({
  invoice_id: Joi.number().integer().allow(null),
  proposal_id: Joi.number().integer().allow(null),
  project_id: Joi.number().integer().allow(null),
  payment_type: Joi.string().valid('advance', 'interim', 'final', 'broker_commission', 'developer_payment', 'recurring').required(),
  amount: Joi.number().positive().required(),
  payment_date: Joi.date().required(),
  payment_method: Joi.string().allow('', null),
  reference_number: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  recipient_name: Joi.string().allow('', null),
  recipient_type: Joi.string().valid('broker', 'developer', 'company').default('company'),
});

const getPayments = async (req, res) => {
  try {
    const { invoice_id, proposal_id, project_id } = req.query;
    let query = `
      SELECT p.*,
        i.invoice_number, i.project_id AS invoice_project_id,
        ps.stage_name,
        pr.proposal_number,
        proj.name AS project_name,
        CASE WHEN p.recipient_type = 'company' THEN 'income' ELSE 'outgoing' END AS direction
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN payment_stages ps ON i.payment_stage_id = ps.id
      LEFT JOIN proposals pr ON p.proposal_id = pr.id
      LEFT JOIN projects proj ON p.project_id = proj.id
      WHERE 1=1
    `;
    const params = [];

    if (invoice_id) {
      query += ' AND p.invoice_id = ?';
      params.push(invoice_id);
    }
    if (proposal_id) {
      query += ' AND p.proposal_id = ?';
      params.push(proposal_id);
    }
    if (project_id) {
      // Include direct project payments AND invoice-linked payments for this project
      query += ' AND (p.project_id = ? OR (p.invoice_id IS NOT NULL AND i.project_id = ?))';
      params.push(project_id, project_id);
    }

    query += ' ORDER BY p.payment_date DESC';

    const [payments] = await pool.execute(query, params);
    res.json({ payments });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE id = ?',
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment: payments[0] });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createPayment = async (req, res) => {
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO payments (invoice_id, proposal_id, project_id, payment_type, amount,
       payment_date, payment_method, reference_number, description, recipient_name, recipient_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        value.invoice_id || null,
        value.proposal_id || null,
        value.project_id || null,
        value.payment_type,
        value.amount,
        value.payment_date,
        value.payment_method || null,
        value.reference_number || null,
        value.description || null,
        value.recipient_name || null,
        value.recipient_type,
        req.user.id,
      ]
    );

    // Update invoice status if payment is for invoice
    if (value.invoice_id) {
      const [invoices] = await pool.execute(
        'SELECT final_amount, payment_stage_id FROM invoices WHERE id = ?',
        [value.invoice_id]
      );

      if (invoices.length > 0) {
        const [paymentSum] = await pool.execute(
          'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ?',
          [value.invoice_id]
        );

        const totalPaid = parseFloat(paymentSum[0].total);
        const finalAmount = parseFloat(invoices[0].final_amount);
        const invoicePaid = totalPaid >= finalAmount;

        await pool.execute(
          'UPDATE invoices SET status = ? WHERE id = ?',
          [invoicePaid ? 'paid' : 'sent', value.invoice_id]
        );

        // If invoice is now fully paid, mark the linked payment stage as paid
        if (invoicePaid && invoices[0].payment_stage_id) {
          await pool.execute(
            "UPDATE payment_stages SET status='paid' WHERE id=?",
            [invoices[0].payment_stage_id]
          );
        }
      }
    }

    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ payment: payments[0] });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await pool.execute(
      `UPDATE payments 
       SET invoice_id = ?, proposal_id = ?, project_id = ?, payment_type = ?, amount = ?,
       payment_date = ?, payment_method = ?, reference_number = ?, description = ?,
       recipient_name = ?, recipient_type = ?
       WHERE id = ?`,
      [
        value.invoice_id || null,
        value.proposal_id || null,
        value.project_id || null,
        value.payment_type,
        value.amount,
        value.payment_date,
        value.payment_method || null,
        value.reference_number || null,
        value.description || null,
        value.recipient_name || null,
        value.recipient_type,
        id,
      ]
    );

    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE id = ?',
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment: payments[0] });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM payments WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProjectPayments = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE project_id = ? ORDER BY payment_date DESC',
      [projectId]
    );

    // Calculate totals
    const totals = {
      total_paid: 0,
      advance_payments: 0,
      broker_commissions: 0,
      developer_payments: 0,
      other_payments: 0,
    };

    payments.forEach(payment => {
      const amount = parseFloat(payment.amount);
      totals.total_paid += amount;

      switch (payment.payment_type) {
        case 'advance':
          totals.advance_payments += amount;
          break;
        case 'broker_commission':
          totals.broker_commissions += amount;
          break;
        case 'developer_payment':
          totals.developer_payments += amount;
          break;
        default:
          totals.other_payments += amount;
      }
    });

    res.json({ payments, totals });
  } catch (error) {
    console.error('Get project payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadPaymentProofFile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const [[pmt]] = await pool.execute('SELECT id, proof_path FROM payments WHERE id=?', [id]);
    if (!pmt) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Delete old proof file if it exists
    if (pmt.proof_path) {
      const oldPath = path.join(__dirname, '../../', pmt.proof_path.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const proofPath = `/uploads/payment-proofs/${req.file.filename}`;
    await pool.execute(
      'UPDATE payments SET proof_path=?, proof_original_name=? WHERE id=?',
      [proofPath, req.file.originalname, id]
    );

    const [[updated]] = await pool.execute('SELECT * FROM payments WHERE id=?', [id]);
    res.json({ payment: updated, message: 'Proof uploaded successfully' });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Upload payment proof error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getProjectPayments,
  uploadPaymentProofFile,
};

