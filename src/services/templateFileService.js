const fs = require('fs').promises;
const path = require('path');
const { HTML_TEMPLATES_DIR } = require('../config/paths');

/**
 * Write HTML content to disk and return the absolute file path.
 * @param {'proposals'|'invoices'|'service-agreements'} type
 * @param {number} id  Template DB id
 * @param {string} htmlContent
 * @returns {Promise<string>} Absolute file path
 */
async function saveTemplateFile(type, id, htmlContent) {
  const dir = path.join(HTML_TEMPLATES_DIR, type);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.html`);
  await fs.writeFile(filePath, htmlContent, 'utf8');
  return filePath;
}

/**
 * Read and return HTML content from a template file.
 * @param {string} filePath Absolute file path stored in DB
 * @returns {Promise<string>}
 */
async function loadTemplateFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

/**
 * Delete a template file from disk. Silent if the file does not exist.
 * @param {string} filePath Absolute file path stored in DB
 */
async function deleteTemplateFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { saveTemplateFile, loadTemplateFile, deleteTemplateFile };
