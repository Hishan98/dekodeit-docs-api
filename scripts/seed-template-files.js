/**
 * seed-template-files.js
 *
 * Creates the default HTML template files on disk and inserts the
 * corresponding rows into the three template tables.
 *
 * Run AFTER schema.sql + seed.sql on a fresh database:
 *   node scripts/seed-template-files.js
 *
 * Safe to re-run - existing rows (matched by name) are skipped via
 * INSERT IGNORE, and existing files are overwritten only if the DB row
 * was freshly inserted.
 */

require('dotenv').config();
const path = require('path');
const fs   = require('fs').promises;
const pool = require('../src/config/database');

const ROOT           = path.resolve(__dirname, '..');
const HTML_TEMPLATES = path.join(ROOT, 'uploads', 'html-templates');

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------
const TEMPLATES = [
  {
    table:     'proposal_templates',
    dir:       'proposals',
    name:      'Standard Proposal Template',
    description: 'Default proposal template for Dekode IT',
    variables: JSON.stringify([
      'proposal_number', 'date',
      'customer.name', 'customer.email', 'customer.phone',
      'customer.company', 'customer.address',
      'proposal.total_amount', 'proposal.currency',
      'proposal.valid_until', 'proposal.subject',
    ]),
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Proposal {{proposal_number}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { color: #ea580c; font-size: 24px; font-weight: bold; }
    .section { margin: 30px 0; }
    .total { font-size: 18px; font-weight: bold; color: #ea580c; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f3f4f6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">DEKODE IT</div>
    <h1>PROPOSAL</h1>
    <p><strong>Proposal Number:</strong> {{proposal_number}}</p>
    <p><strong>Date:</strong> {{date}}</p>
    <p><strong>Valid Until:</strong> {{proposal.valid_until}}</p>
  </div>
  <div class="section">
    <h2>Client Information</h2>
    <p><strong>Name:</strong> {{customer.name}}</p>
    <p><strong>Company:</strong> {{customer.company}}</p>
    <p><strong>Email:</strong> {{customer.email}}</p>
    <p><strong>Phone:</strong> {{customer.phone}}</p>
    <p><strong>Address:</strong> {{customer.address}}</p>
  </div>
  <div class="section">
    <h2>Proposal Details</h2>
    <p><strong>Subject:</strong> {{proposal.subject}}</p>
  </div>
  <div class="section">
    <h2>Pricing</h2>
    <p class="total">Total Amount: {{proposal.currency}} {{proposal.total_amount}}</p>
  </div>
  <div class="section">
    <p>Thank you for considering Dekode IT. We look forward to working with you.</p>
    <p>Best regards,<br>Dekode IT Team</p>
  </div>
</body>
</html>`,
  },
  {
    table:     'invoice_templates',
    dir:       'invoices',
    name:      'Standard Invoice Template',
    description: 'Default invoice template for Dekode IT',
    variables: JSON.stringify([
      'invoice_number', 'date',
      'customer.name', 'customer.email', 'customer.phone',
      'customer.company', 'customer.address', 'customer.vat_id',
      'invoice.total_amount', 'invoice.tax_amount', 'invoice.discount_amount',
      'invoice.final_amount', 'invoice.currency', 'invoice.due_date', 'invoice.subject',
    ]),
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice {{invoice_number}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { color: #ea580c; font-size: 24px; font-weight: bold; }
    .section { margin: 30px 0; }
    .total { font-size: 18px; font-weight: bold; color: #ea580c; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f3f4f6; }
    .text-right { text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">DEKODE IT</div>
    <h1>INVOICE</h1>
    <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
    <p><strong>Date:</strong> {{date}}</p>
    <p><strong>Due Date:</strong> {{invoice.due_date}}</p>
  </div>
  <div class="section">
    <h2>Bill To</h2>
    <p><strong>Name:</strong> {{customer.name}}</p>
    <p><strong>Company:</strong> {{customer.company}}</p>
    <p><strong>Email:</strong> {{customer.email}}</p>
    <p><strong>VAT ID:</strong> {{customer.vat_id}}</p>
    <p><strong>Address:</strong> {{customer.address}}</p>
  </div>
  <div class="section">
    <h2>Invoice Details</h2>
    <p><strong>Subject:</strong> {{invoice.subject}}</p>
  </div>
  <div class="section">
    <h2>Amount Summary</h2>
    <table>
      <tr><td>Subtotal:</td><td class="text-right">{{invoice.currency}} {{invoice.total_amount}}</td></tr>
      <tr><td>Tax:</td><td class="text-right">{{invoice.currency}} {{invoice.tax_amount}}</td></tr>
      <tr><td>Discount:</td><td class="text-right">{{invoice.currency}} {{invoice.discount_amount}}</td></tr>
      <tr>
        <td class="total"><strong>Total:</strong></td>
        <td class="text-right total"><strong>{{invoice.currency}} {{invoice.final_amount}}</strong></td>
      </tr>
    </table>
  </div>
  <div class="section">
    <p>Thank you for your business!</p>
    <p>Best regards,<br>Dekode IT Team</p>
  </div>
</body>
</html>`,
  },
  {
    table:     'service_agreement_templates',
    dir:       'service-agreements',
    name:      'Standard Service Agreement',
    description: 'Default service agreement template',
    variables: JSON.stringify([
      'agreement_number', 'date',
      'customer.name', 'customer.email', 'customer.phone',
      'customer.company', 'customer.address',
      'project.name', 'agreement.subject',
    ]),
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Service Agreement {{agreement_number}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    .header { border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { color: #ea580c; font-size: 24px; font-weight: bold; }
    .section { margin: 30px 0; }
    .signature-section { margin-top: 50px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">DEKODE IT</div>
    <h1>SERVICE AGREEMENT</h1>
    <p><strong>Agreement Number:</strong> {{agreement_number}}</p>
    <p><strong>Date:</strong> {{date}}</p>
    <p><strong>Subject:</strong> {{agreement.subject}}</p>
  </div>
  <div class="section">
    <h2>Parties</h2>
    <p><strong>Service Provider:</strong> Dekode IT</p>
    <p><strong>Client:</strong> {{customer.name}}, {{customer.company}}</p>
    <p><strong>Email:</strong> {{customer.email}} | <strong>Phone:</strong> {{customer.phone}}</p>
    <p><strong>Address:</strong> {{customer.address}}</p>
  </div>
  <div class="section">
    <h2>Project</h2>
    <p><strong>Project Name:</strong> {{project.name}}</p>
  </div>
  <div class="section">
    <h2>Terms and Conditions</h2>
    <p>This agreement outlines the terms for services provided by Dekode IT.</p>
    <p>All services will be delivered in accordance with industry best practices.</p>
    <p>Payment terms, deliverables, and timelines are as specified in the related proposal.</p>
  </div>
  <div class="signature-section">
    <p>By signing below, both parties agree to the terms of this agreement.</p>
    <br><br>
    <p>_________________________<br>Dekode IT</p>
    <br><br>
    <p>_________________________<br>{{customer.name}}</p>
  </div>
</body>
</html>`,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  console.log('Seeding template files...\n');

  for (const tpl of TEMPLATES) {
    const targetDir = path.join(HTML_TEMPLATES, tpl.dir);
    await fs.mkdir(targetDir, { recursive: true });

    // Check if a row with this name already exists (seeded by seed.sql with file_path='')
    const [rows] = await pool.execute(
      `SELECT id FROM ${tpl.table} WHERE name = ? LIMIT 1`,
      [tpl.name],
    );

    let id;
    if (rows.length > 0) {
      id = rows[0].id;
    } else {
      // Insert metadata row to get the auto-increment id
      const [result] = await pool.execute(
        `INSERT INTO ${tpl.table} (name, description, file_path, variables, created_by)
         VALUES (?, ?, '', ?, 1)`,
        [tpl.name, tpl.description, tpl.variables],
      );
      id = result.insertId;
    }

    const filePath = path.join(targetDir, `${id}.html`);

    await fs.writeFile(filePath, tpl.html, 'utf8');

    await pool.execute(
      `UPDATE ${tpl.table} SET file_path = ? WHERE id = ?`,
      [filePath, id],
    );

    console.log(`  [${tpl.table}] id=${id} -> ${path.relative(ROOT, filePath)}`);
  }

  console.log('\nTemplate seeding complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
