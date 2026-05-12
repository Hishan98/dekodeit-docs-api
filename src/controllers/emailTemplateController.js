const fs   = require("fs").promises;
const path = require("path");
const Joi  = require("joi");

const sectionsSchema = Joi.object({
  subject:  Joi.string().max(500).allow("").default(""),
  greeting: Joi.string().max(500).allow("").default(""),
  body:     Joi.string().max(10000).allow("").default(""),
  closing:  Joi.string().max(1000).allow("").default(""),
});

const TEMPLATES_DIR = path.join(__dirname, "..", "emailTemplates");

const TEMPLATE_META = [
  { key: "proposal",               label: "Proposal Sent",            subject: "Proposal {{proposalNumber}} - Dekode IT",                  variables: ["customerName", "proposalNumber"] },
  { key: "proposalAccepted",       label: "Proposal Accepted",        subject: "Proposal {{proposalNumber}} Accepted - Dekode IT",         variables: ["customerName", "proposalNumber"] },
  { key: "invoice",                label: "Invoice Sent",             subject: "Invoice {{invoiceNumber}} - Dekode IT",                    variables: ["customerName", "invoiceNumber"] },
  { key: "invoiceReminder",        label: "Invoice Reminder",         subject: "Payment Reminder - Invoice {{invoiceNumber}} - Dekode IT", variables: ["customerName", "invoiceNumber", "dueDate", "amount"] },
  { key: "serviceAgreement",       label: "Service Agreement Sent",   subject: "Service Agreement {{agreementNumber}} - Dekode IT",        variables: ["customerName", "agreementNumber"] },
  { key: "serviceAgreementSigned", label: "Service Agreement Signed", subject: "Service Agreement {{agreementNumber}} Signed - Dekode IT", variables: ["customerName", "agreementNumber", "projectName"] },
  { key: "purchaseOrderRequest",   label: "PO Request",               subject: "Purchase Order Request - {{projectName}} - Dekode IT",     variables: ["customerName", "projectName", "proposalNumber"] },
  { key: "purchaseOrderReceived",  label: "PO Received",              subject: "Purchase Order Received - {{projectName}} - Dekode IT",    variables: ["customerName", "projectName", "proposalNumber"] },
  { key: "customerFollowup",       label: "Customer Follow-up",       subject: "Project Update - {{projectName}} - Dekode IT",             variables: ["customerName", "projectName", "currentPhase", "status", "nextSteps", "customMessage"] },
  { key: "otp",                    label: "OTP / Password Reset",     subject: "Password Reset OTP - Dekode IT",                          variables: ["userName", "otp"] },
];

const VALID_KEYS = new Set(TEMPLATE_META.map((t) => t.key));

// ── Default section content per template ────────────────────────────────────

const SECTION_DEFAULTS = {
  proposal: {
    greeting: "Dear {{customerName}},",
    body: "Thank you for your interest in our services. Please find attached our proposal {{proposalNumber}} for your review.\n\nWe look forward to working with you and welcome any questions you may have.",
    cta_text: "View Proposal",
    closing: "Best regards,\nDekode IT Team",
  },
  proposalAccepted: {
    greeting: "Dear {{customerName}},",
    body: "We are delighted to inform you that proposal {{proposalNumber}} has been accepted. Thank you for choosing Dekode IT.\n\nOur team will be in touch shortly to discuss the next steps.",
    cta_text: "",
    closing: "Best regards,\nDekode IT Team",
  },
  invoice: {
    greeting: "Dear {{customerName}},",
    body: "Please find attached invoice {{invoiceNumber}} for your records.\n\nKindly complete the payment by the due date. If you have any questions, please do not hesitate to contact us.",
    cta_text: "View Invoice",
    closing: "Best regards,\nDekode IT Team",
  },
  invoiceReminder: {
    greeting: "Dear {{customerName}},",
    body: "Invoice {{invoiceNumber}} is due on {{dueDate}} for {{amount}}. Please arrange payment at your earliest convenience to avoid any service interruptions.\n\nIf you have already made the payment, please disregard this reminder.",
    cta_text: "",
    closing: "Best regards,\nDekode IT Team",
  },
  serviceAgreement: {
    greeting: "Dear {{customerName}},",
    body: "Please find attached Service Agreement {{agreementNumber}} for your review and signature.\n\nPlease sign and return the agreement at your earliest convenience so we can commence work.",
    cta_text: "View Agreement",
    closing: "Best regards,\nDekode IT Team",
  },
  serviceAgreementSigned: {
    greeting: "Dear {{customerName}},",
    body: "We are pleased to confirm that Service Agreement {{agreementNumber}} for project {{projectName}} has been signed and is now in effect.\n\nWe look forward to a productive partnership.",
    cta_text: "",
    closing: "Best regards,\nDekode IT Team",
  },
  purchaseOrderRequest: {
    greeting: "Dear {{customerName}},",
    body: "We are reaching out regarding proposal {{proposalNumber}} for project {{projectName}}.\n\nTo proceed with the project, kindly provide a Purchase Order (PO) at your earliest convenience.",
    cta_text: "",
    closing: "Best regards,\nDekode IT Team",
  },
  purchaseOrderReceived: {
    greeting: "Dear {{customerName}},",
    body: "We are pleased to confirm that we have received your Purchase Order for proposal {{proposalNumber}} for project {{projectName}}.\n\nWork will commence as per the agreed schedule.",
    cta_text: "",
    closing: "Best regards,\nDekode IT Team",
  },
  customerFollowup: {
    greeting: "Dear {{customerName}},",
    body: "We wanted to provide a quick update on project {{projectName}}.\n\nCurrent Phase: {{currentPhase}}\nStatus: {{status}}\n\nNext Steps: {{nextSteps}}\n\n{{customMessage}}",
    cta_text: "",
    closing: "Best regards,\nDekode IT Team",
  },
  otp: {
    greeting: "Dear {{userName}},",
    body: "You have requested to reset your password for your Dekode IT account. Please use the one-time code below to verify your identity.",
    cta_text: "This code expires in 15 minutes. Do not share it with anyone. If you did not request this reset, please ignore this email.",
    closing: "Best regards,\nDekode IT Team",
  },
};

// ── HTML assembly ────────────────────────────────────────────────────────────

const EMAIL_WRAPPER = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;}
    .wrap{max-width:580px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}
    .hdr{background:#ea580c;padding:22px 32px;}
    .hdr h1{margin:0;color:#fff;font-size:20px;letter-spacing:.5px;}
    .bdy{padding:32px;color:#333;line-height:1.65;font-size:15px;}
    .bdy p{margin:0 0 14px;}
    .cta{text-align:center;margin:26px 0;}
    .cta a{display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;}
    hr{border:none;border-top:1px solid #e5e7eb;margin:22px 0;}
    .closing{color:#555;font-size:14px;}
    .otp-box{background:#fef2e8;border:2px solid #ea580c;border-radius:8px;padding:18px;text-align:center;margin:20px 0;}
    .otp-code{color:#ea580c;font-size:34px;letter-spacing:10px;font-family:'Courier New',monospace;margin:0;font-weight:700;}
    .urgent{background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;margin:16px 0;border-radius:0 6px 6px 0;font-size:14px;}
    .note{color:#666;font-size:13px;margin:12px 0;}
    .ftr{background:#f9fafb;padding:14px 32px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr"><h1>DEKODE IT</h1></div>
    <div class="bdy">__BODY__</div>
    <div class="ftr">Dekode IT &middot; Colombo, Sri Lanka</div>
  </div>
</body>
</html>`;

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2p(text) {
  if (!text || !text.trim()) return "";
  // Escape first, then restore {{variable}} placeholders (they are safe — emailService substitutes them server-side)
  const escaped = escapeHtml(text).replace(/\{\{(\w+)\}\}/g, (_, k) => `{{${k}}}`);
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n    ");
}

function assembleSectionHtml(key, sections) {
  const { greeting = "", body = "", closing = "" } = sections;
  const cta_text = SECTION_DEFAULTS[key]?.cta_text ?? "";
  const parts = [];

  if (greeting.trim()) parts.push(nl2p(greeting));

  if (key === "invoiceReminder") {
    if (body.trim()) parts.push(`<div class="urgent">${nl2p(body)}</div>`);
  } else if (key === "otp") {
    if (body.trim()) parts.push(nl2p(body));
    parts.push('<div class="otp-box"><p class="otp-code">{{otp}}</p></div>');
    if (cta_text.trim()) parts.push(`<p class="note">${escapeHtml(cta_text).replace(/\n/g, "<br>")}</p>`);
  } else {
    if (body.trim()) parts.push(nl2p(body));
    if (cta_text.trim()) parts.push(`<div class="cta"><a href="#">${cta_text}</a></div>`);
  }

  parts.push("<hr>");
  if (closing.trim()) parts.push(`<div class="closing">${nl2p(closing)}</div>`);

  return EMAIL_WRAPPER.replace("__BODY__", parts.join("\n    "));
}

// ── Controller handlers ──────────────────────────────────────────────────────

/**
 * GET /api/email-templates
 * Returns the metadata list (no section bodies).
 */
const listTemplates = (_req, res) => {
  res.json({ templates: TEMPLATE_META });
};

/**
 * GET /api/email-templates/:key
 * Returns metadata plus the editable sections for one template.
 * Falls back to defaults if the user has never saved this template.
 */
const getTemplate = async (req, res) => {
  const { key } = req.params;
  if (!VALID_KEYS.has(key)) return res.status(404).json({ error: "Template not found" });

  const meta = TEMPLATE_META.find((t) => t.key === key);
  let sections = {
    subject: meta.subject,
    ...(SECTION_DEFAULTS[key] ?? { greeting: "", body: "", cta_text: "", closing: "" }),
  };

  try {
    const raw = await fs.readFile(path.join(TEMPLATES_DIR, `${key}.json`), "utf8");
    sections = { ...sections, ...JSON.parse(raw) };
  } catch {
    // No saved JSON yet - return defaults
  }

  res.json({ ...meta, sections });
};

/**
 * PUT /api/email-templates/:key
 * Accepts { sections: { greeting, body, cta_text, closing } }.
 * Assembles full HTML, writes both .json (sections) and .html (email) to disk.
 * Admin only (enforced by route middleware).
 */
const updateTemplate = async (req, res) => {
  const { key } = req.params;
  if (!VALID_KEYS.has(key)) return res.status(404).json({ error: "Template not found" });

  const { sections } = req.body;
  if (!sections || typeof sections !== "object") {
    return res.status(400).json({ error: "sections object is required" });
  }

  const { error: valErr, value: clean } = sectionsSchema.validate(sections, { stripUnknown: true });
  if (valErr) return res.status(400).json({ error: valErr.details[0].message });

  const meta = TEMPLATE_META.find((t) => t.key === key);
  if (!clean.subject) clean.subject = meta.subject;

  try {
    const html = assembleSectionHtml(key, clean);
    await fs.writeFile(path.join(TEMPLATES_DIR, `${key}.json`), JSON.stringify(clean, null, 2), "utf8");
    await fs.writeFile(path.join(TEMPLATES_DIR, `${key}.html`), html, "utf8");
    res.json({ message: "Template updated successfully", key });
  } catch (err) {
    console.error("updateTemplate error:", err);
    res.status(500).json({ error: "Failed to write template file" });
  }
};

module.exports = { listTemplates, getTemplate, updateTemplate };
