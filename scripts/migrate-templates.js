/**
 * migrate-templates.js
 *
 * One-time migration: moves html_content out of the three template tables
 * and onto disk as .html files under uploads/html-templates/.
 *
 * Run BEFORE the DROP COLUMN statements in database/migrations.sql.
 *
 * Usage:
 *   node scripts/migrate-templates.js
 *
 * Safe to re-run — rows that already have file_path set are skipped.
 */

require('dotenv').config();
const path = require('path');
const fs   = require('fs').promises;
const pool = require('../src/config/database');

// Resolve uploads directory relative to project root
const ROOT             = path.resolve(__dirname, '..');
const HTML_TEMPLATES   = path.join(ROOT, 'uploads', 'html-templates');

const TYPES = [
  { table: 'proposal_templates',          dir: 'proposals' },
  { table: 'invoice_templates',           dir: 'invoices' },
  { table: 'service_agreement_templates', dir: 'service-agreements' },
];

async function migrate() {
  console.log('Starting template file migration...\n');

  for (const { table, dir } of TYPES) {
    const targetDir = path.join(HTML_TEMPLATES, dir);
    await fs.mkdir(targetDir, { recursive: true });

    // Only select rows that still have html_content and haven't been migrated yet
    const [rows] = await pool.execute(
      `SELECT id, html_content FROM ${table}
       WHERE html_content IS NOT NULL AND html_content != ''
         AND (file_path IS NULL OR file_path = '')`,
    );

    console.log(`[${table}] ${rows.length} row(s) to migrate`);

    for (const row of rows) {
      const filePath = path.join(targetDir, `${row.id}.html`);
      await fs.writeFile(filePath, row.html_content, 'utf8');

      await pool.execute(
        `UPDATE ${table} SET file_path = ? WHERE id = ?`,
        [filePath, row.id],
      );

      console.log(`  ✓ Template ${row.id} → ${path.relative(ROOT, filePath)}`);
    }
  }

  console.log('\nMigration complete.');
  console.log('You can now run the DROP COLUMN statements in database/migrations.sql.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
