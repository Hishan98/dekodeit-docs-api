const path = require('path');
const fs = require('fs');

// Project root is two levels up from src/config/
const ROOT = path.resolve(__dirname, '..', '..');

const UPLOADS_DIR        = path.join(ROOT, 'uploads');
const PDF_DIR            = path.join(UPLOADS_DIR, 'pdfs');
const AVATAR_DIR         = path.join(UPLOADS_DIR, 'avatars');
const HTML_TEMPLATES_DIR = path.join(UPLOADS_DIR, 'html-templates');

// Ensure directories exist at startup (idempotent)
[
  PDF_DIR,
  AVATAR_DIR,
  path.join(HTML_TEMPLATES_DIR, 'proposals'),
  path.join(HTML_TEMPLATES_DIR, 'invoices'),
  path.join(HTML_TEMPLATES_DIR, 'service-agreements'),
].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

module.exports = { ROOT, UPLOADS_DIR, PDF_DIR, AVATAR_DIR, HTML_TEMPLATES_DIR };
