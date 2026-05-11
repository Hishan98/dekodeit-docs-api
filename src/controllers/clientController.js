const pool = require('../config/database');
const Joi = require('joi');

const clientSchema = Joi.object({
  company_name: Joi.string().required(),
  website:      Joi.string().uri().allow('', null),
  address:      Joi.string().allow('', null),
  vat_id:       Joi.string().allow('', null),
  notes:        Joi.string().allow('', null),
  // Optional primary contact - supplied together with the client on create/update
  contact_name:      Joi.string().allow('', null),
  contact_job_title: Joi.string().allow('', null),
  contact_email:     Joi.string().email().allow('', null),
  contact_phone:     Joi.string().allow('', null),
});

const contactSchema = Joi.object({
  name:       Joi.string().required(),
  job_title:  Joi.string().allow('', null),
  email:      Joi.string().email().allow('', null),
  phone:      Joi.string().allow('', null),
  is_primary: Joi.boolean().truthy(1).falsy(0).default(false),
  notes:      Joi.string().allow('', null),
});

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------
const getClients = async (req, res) => {
  try {
    const { status } = req.query;
    const allowedStatuses = ['active', 'inactive', 'archived'];
    const filterStatus = allowedStatuses.includes(status) ? status : null;

    let query = `
      SELECT c.*,
             u.name  AS created_by_name,
             cc.name AS primary_contact_name,
             cc.job_title AS primary_contact_job_title,
             cc.email AS primary_contact_email,
             cc.phone AS primary_contact_phone
      FROM clients c
      LEFT JOIN users u          ON u.id = c.created_by
      LEFT JOIN client_contacts cc ON cc.client_id = c.id AND cc.is_primary = TRUE`;

    const params = [];
    if (status === 'all') {
      // no filter
    } else if (filterStatus) {
      query += ' WHERE c.status = ?';
      params.push(filterStatus);
    } else {
      query += " WHERE c.status = 'active'";
    }
    query += ' ORDER BY c.created_at DESC';

    const [clients] = await pool.execute(query, params);
    res.json({ clients });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/clients/:id
// ---------------------------------------------------------------------------
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[client]] = await pool.execute(
      `SELECT c.*, u.name AS created_by_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = ?`,
      [id],
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const [contacts] = await pool.execute(
      `SELECT * FROM client_contacts
       WHERE client_id = ?
       ORDER BY is_primary DESC, id ASC`,
      [id],
    );

    res.json({ client: { ...client, contacts } });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------
const createClient = async (req, res) => {
  try {
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `INSERT INTO clients (company_name, website, address, vat_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        value.company_name,
        value.website    || null,
        value.address    || null,
        value.vat_id     || null,
        value.notes      || null,
        req.user.id,
      ],
    );

    const clientId = result.insertId;

    // Create primary contact if contact details were supplied
    if (value.contact_name) {
      await pool.execute(
        `INSERT INTO client_contacts (client_id, name, job_title, email, phone, is_primary)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [
          clientId,
          value.contact_name,
          value.contact_job_title || null,
          value.contact_email     || null,
          value.contact_phone     || null,
        ],
      );
    }

    const [[client]] = await pool.execute(
      `SELECT c.*, u.name AS created_by_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = ?`,
      [clientId],
    );

    const [contacts] = await pool.execute(
      'SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, id ASC',
      [clientId],
    );

    res.status(201).json({ client: { ...client, contacts } });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/clients/:id
// ---------------------------------------------------------------------------
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const [result] = await pool.execute(
      `UPDATE clients SET company_name = ?, website = ?, address = ?, vat_id = ?, notes = ?
       WHERE id = ?`,
      [
        value.company_name,
        value.website || null,
        value.address || null,
        value.vat_id  || null,
        value.notes   || null,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // If a contact_name was provided, upsert the primary contact
    if (value.contact_name) {
      const [[existing]] = await pool.execute(
        'SELECT id FROM client_contacts WHERE client_id = ? AND is_primary = TRUE LIMIT 1',
        [id],
      );

      if (existing) {
        await pool.execute(
          `UPDATE client_contacts
           SET name = ?, job_title = ?, email = ?, phone = ?
           WHERE id = ?`,
          [
            value.contact_name,
            value.contact_job_title || null,
            value.contact_email     || null,
            value.contact_phone     || null,
            existing.id,
          ],
        );
      } else {
        await pool.execute(
          `INSERT INTO client_contacts (client_id, name, job_title, email, phone, is_primary)
           VALUES (?, ?, ?, ?, ?, TRUE)`,
          [
            id,
            value.contact_name,
            value.contact_job_title || null,
            value.contact_email     || null,
            value.contact_phone     || null,
          ],
        );
      }
    }

    const [[client]] = await pool.execute(
      `SELECT c.*, u.name AS created_by_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = ?`,
      [id],
    );

    const [contacts] = await pool.execute(
      'SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, id ASC',
      [id],
    );

    res.json({ client: { ...client, contacts } });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/clients/:id/status
// ---------------------------------------------------------------------------
const updateClientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['active', 'inactive', 'archived'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'status must be one of: active, inactive, archived' });
    }

    const [result] = await pool.execute(
      'UPDATE clients SET status = ? WHERE id = ?',
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const [[client]] = await pool.execute(
      `SELECT c.*, u.name AS created_by_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.id = ?`,
      [id],
    );

    const [contacts] = await pool.execute(
      'SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, id ASC',
      [id],
    );

    res.json({ client: { ...client, contacts } });
  } catch (error) {
    console.error('Update client status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/clients/:id  - archives the client (soft delete)
// ---------------------------------------------------------------------------
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      "UPDATE clients SET status = 'archived' WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client archived successfully' });
  } catch (error) {
    console.error('Archive client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/clients/:id/linked
// ---------------------------------------------------------------------------
const getLinkedRecords = async (req, res) => {
  try {
    const { id } = req.params;

    const [projects] = await pool.execute(
      `SELECT id, name, phase, status, total_amount, start_date, end_date, created_at
       FROM projects
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [id],
    );

    const [proposals] = await pool.execute(
      `SELECT id, proposal_number, subject, status, total_amount, currency, valid_until, created_at
       FROM proposals
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [id],
    );

    const [invoices] = await pool.execute(
      `SELECT id, invoice_number, subject, status, final_amount, currency, due_date, created_at
       FROM invoices
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [id],
    );

    const [recurringBills] = await pool.execute(
      `SELECT rb.id, rb.amount, rb.frequency, rb.status, rb.next_billing_date, rb.start_date, rb.end_date,
              p.name AS project_name, s.name AS service_name
       FROM recurring_bills rb
       LEFT JOIN projects p ON p.id = rb.project_id
       LEFT JOIN services s ON s.id = rb.service_id
       WHERE rb.client_id = ?
       ORDER BY rb.next_billing_date ASC`,
      [id],
    );

    // Financial summary
    const totalProjectValue = projects.reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const totalInvoiced     = invoices.reduce((s, i) => s + Number(i.final_amount || 0), 0);
    const totalPaid         = invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + Number(i.final_amount || 0), 0);
    const outstanding = totalInvoiced - totalPaid;

    res.json({
      summary: { totalProjectValue, totalInvoiced, totalPaid, outstanding },
      projects,
      proposals,
      invoices,
      recurringBills,
    });
  } catch (error) {
    console.error('Get linked records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/clients/:id/contacts
// ---------------------------------------------------------------------------
const addContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = contactSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // If this contact is being set as primary, unset the current primary first
    if (value.is_primary) {
      await pool.execute(
        'UPDATE client_contacts SET is_primary = FALSE WHERE client_id = ?',
        [id],
      );
    }

    const [result] = await pool.execute(
      `INSERT INTO client_contacts (client_id, name, job_title, email, phone, is_primary, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, value.name, value.job_title || null, value.email || null, value.phone || null, value.is_primary, value.notes || null],
    );

    const [[contact]] = await pool.execute(
      'SELECT * FROM client_contacts WHERE id = ?',
      [result.insertId],
    );

    res.status(201).json({ contact });
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/clients/:id/contacts/:contactId
// ---------------------------------------------------------------------------
const updateContact = async (req, res) => {
  try {
    const { id, contactId } = req.params;
    const { error, value } = contactSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // If promoting this contact to primary, demote any existing primary first
    if (value.is_primary) {
      await pool.execute(
        'UPDATE client_contacts SET is_primary = FALSE WHERE client_id = ? AND id != ?',
        [id, contactId],
      );
    }

    const [result] = await pool.execute(
      `UPDATE client_contacts
       SET name = ?, job_title = ?, email = ?, phone = ?, is_primary = ?, notes = ?
       WHERE id = ? AND client_id = ?`,
      [value.name, value.job_title || null, value.email || null, value.phone || null, value.is_primary, value.notes || null, contactId, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const [[contact]] = await pool.execute(
      'SELECT * FROM client_contacts WHERE id = ?',
      [contactId],
    );

    res.json({ contact });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/clients/:id/contacts/:contactId
// ---------------------------------------------------------------------------
const deleteContact = async (req, res) => {
  try {
    const { id, contactId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM client_contacts WHERE id = ? AND client_id = ?',
      [contactId, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  updateClientStatus,
  deleteClient,
  getLinkedRecords,
  addContact,
  updateContact,
  deleteContact,
};
