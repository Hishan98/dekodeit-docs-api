const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate PDF from HTML content
 */
const PDF_TIMEOUT_MS = parseInt(process.env.PDF_TIMEOUT_MS || '30000', 10); // 30s default

async function generatePDF(htmlContent, outputPath) {
  let browser;
  const timeoutHandle = setTimeout(() => {
    if (browser) browser.close().catch(() => {});
  }, PDF_TIMEOUT_MS);

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: PDF_TIMEOUT_MS,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(PDF_TIMEOUT_MS);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: PDF_TIMEOUT_MS });

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });

    clearTimeout(timeoutHandle);
    await browser.close();
    return outputPath;
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', error);
    throw error;
  }
}

/**
 * Escape a string for safe insertion into HTML.
 * Prevents XSS / HTML injection from user-supplied data (names, addresses, etc.)
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Replace template variables in HTML.
 * All variable values are HTML-escaped before substitution.
 */
function replaceTemplateVariables(html, variables) {
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    return escapeHtml(variables[key]);
  });
}

module.exports = {
  generatePDF,
  replaceTemplateVariables,
};

