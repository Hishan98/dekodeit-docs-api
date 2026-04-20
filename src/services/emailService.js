const nodemailer = require("nodemailer");
const fs = require("fs").promises;
const path = require("path");

// Singleton transporter — created once, reused across calls
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    pool: true,
    maxConnections: 5,
    socketTimeout: 10000,
    tls: {
      // Only allow self-signed certs in development.
      // In production, proper TLS verification is enforced.
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return transporter;
}

/**
 * Verify SMTP connection — call on startup to catch misconfig early.
 */
async function verifyConnection() {
  try {
    await getTransporter().verify();
    console.log("SMTP connection verified successfully.");
  } catch (error) {
    console.error("SMTP connection failed:", error.message);
    // Don't throw — app should still start, emails will fail gracefully
  }
}

/**
 * Load an HTML email template and interpolate {{variable}} placeholders.
 */
async function loadTemplate(templateName, variables = {}) {
  const templatePath = path.join(
    __dirname,
    "..",
    "emailTemplates",
    `${templateName}.html`
  );

  let html;
  try {
    html = await fs.readFile(templatePath, "utf8");
  } catch (error) {
    throw new Error(`Email template "${templateName}" not found at ${templatePath}`);
  }

  // Replace all {{key}} occurrences — values are HTML-escaped to prevent injection
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = variables[key] ?? '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  });
}

/**
 * Core email sender. All other functions delegate to this.
 *
 * @param {object} options
 * @param {string|string[]} options.to         - Recipient(s)
 * @param {string}          options.subject    - Email subject
 * @param {string}          options.templateName - Template file name (no extension)
 * @param {object}          [options.variables]  - Template interpolation map
 * @param {object[]}        [options.attachments] - Nodemailer attachment objects
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
async function sendEmail({ to, subject, templateName, variables = {}, attachments = [] }) {
  const html = await loadTemplate(templateName, variables);

  const mailOptions = {
    from: `"Dekode IT" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[Email] Sent "${subject}" to ${to} — messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Domain-specific helpers
// ---------------------------------------------------------------------------

/**
 * Send a proposal PDF to a customer.
 */
async function sendProposalEmail(customerEmail, customerName, proposalNumber, pdfPath) {
  return sendEmail({
    to: customerEmail,
    subject: `Proposal ${proposalNumber} - Dekode IT`,
    templateName: "proposal",
    variables: { customerName, proposalNumber },
    attachments: [
      {
        filename: `proposal_${proposalNumber}.pdf`,
        path: pdfPath,
      },
    ],
  });
}

/**
 * Send an invoice PDF to a customer.
 */
async function sendInvoiceEmail(customerEmail, customerName, invoiceNumber, pdfPath) {
  return sendEmail({
    to: customerEmail,
    subject: `Invoice ${invoiceNumber} - Dekode IT`,
    templateName: "invoice",
    variables: { customerName, invoiceNumber },
    attachments: [
      {
        filename: `invoice_${invoiceNumber}.pdf`,
        path: pdfPath,
      },
    ],
  });
}

/**
 * Send a one-time password for account/password reset flows.
 */
async function sendOTPEmail(userEmail, userName, otp) {
  return sendEmail({
    to: userEmail,
    subject: "Password Reset OTP - Dekode IT",
    templateName: "otp",
    variables: {
      userName: userName || "User",
      otp,
    },
  });
}

/**
 * Send a payment-due reminder for an outstanding invoice.
 */
async function sendInvoiceReminderEmail(customerEmail, customerName, invoiceNumber, dueDate, amount) {
  return sendEmail({
    to: customerEmail,
    subject: `Payment Reminder - Invoice ${invoiceNumber} - Dekode IT`,
    templateName: "invoiceReminder",
    variables: { customerName, invoiceNumber, dueDate, amount },
  });
}

/**
 * Send a project status follow-up to a customer.
 */
async function sendCustomerFollowupEmail(
  customerEmail,
  customerName,
  projectName,
  currentPhase,
  status,
  nextSteps,
  customMessage = ""
) {
  return sendEmail({
    to: customerEmail,
    subject: `Project Update - ${projectName} - Dekode IT`,
    templateName: "customerFollowup",
    variables: { customerName, projectName, currentPhase, status, nextSteps, customMessage },
  });
}

module.exports = {
  verifyConnection,
  sendEmail,
  sendProposalEmail,
  sendInvoiceEmail,
  sendOTPEmail,
  sendInvoiceReminderEmail,
  sendCustomerFollowupEmail,
};
