const express  = require("express");
const router   = express.Router();
const ctrl     = require("../controllers/emailTemplateController");
const authenticate = require("../middleware/auth");
const roleCheck    = require("../middleware/roleCheck");

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Email Templates
 *   description: Manage email notification templates. Content is stored as structured sections (subject, greeting, body, closing) in .json files; the server assembles and writes the final .html used for sending.
 */

/**
 * @swagger
 * /api/email-templates:
 *   get:
 *     summary: List all email templates (metadata only, no HTML)
 *     tags: [Email Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of template metadata objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                         example: proposal
 *                       label:
 *                         type: string
 *                         example: Proposal Sent
 *                       subject:
 *                         type: string
 *                         example: "Proposal {{proposalNumber}} - Dekode IT"
 *                       variables:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["customerName", "proposalNumber"]
 *       401:
 *         description: Unauthorized
 */
router.get("/", ctrl.listTemplates);

/**
 * @swagger
 * /api/email-templates/{key}:
 *   get:
 *     summary: Get a single template - metadata plus editable sections
 *     tags: [Email Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - proposal
 *             - proposalAccepted
 *             - invoice
 *             - invoiceReminder
 *             - serviceAgreement
 *             - serviceAgreementSigned
 *             - purchaseOrderRequest
 *             - purchaseOrderReceived
 *             - customerFollowup
 *             - otp
 *         description: Template identifier (matches the .json/.html filename without extension)
 *     responses:
 *       200:
 *         description: Template metadata plus editable sections (falls back to hardcoded defaults if never saved)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:       { type: string }
 *                 label:     { type: string }
 *                 subject:   { type: string }
 *                 variables: { type: array, items: { type: string } }
 *                 sections:
 *                   type: object
 *                   description: Editable content sections (subject, greeting, body, closing)
 *                   properties:
 *                     subject:  { type: string }
 *                     greeting: { type: string }
 *                     body:     { type: string }
 *                     closing:  { type: string }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Template key not recognised
 */
router.get("/:key", ctrl.getTemplate);

/**
 * @swagger
 * /api/email-templates/{key}:
 *   put:
 *     summary: Update a template's sections, assemble HTML, and save to disk (admin only)
 *     tags: [Email Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Template identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sections
 *             properties:
 *               sections:
 *                 type: object
 *                 description: Structured content sections. The server assembles the final HTML.
 *                 properties:
 *                   subject:
 *                     type: string
 *                     example: "Invoice {{invoiceNumber}} - Dekode IT"
 *                   greeting:
 *                     type: string
 *                     example: "Dear {{customerName}},"
 *                   body:
 *                     type: string
 *                     example: "Please find attached invoice {{invoiceNumber}}."
 *                   closing:
 *                     type: string
 *                     example: "Best regards,\nDekode IT Team"
 *     responses:
 *       200:
 *         description: Template saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 key:     { type: string }
 *       400:
 *         description: sections object missing or invalid
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Template key not recognised
 *       500:
 *         description: Failed to write file to disk
 */
router.put("/:key", roleCheck(["admin"]), ctrl.updateTemplate);

module.exports = router;
