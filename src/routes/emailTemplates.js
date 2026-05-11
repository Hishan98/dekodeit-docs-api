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
 *   description: Manage HTML email notification templates stored on disk under src/emailTemplates/
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
 *     summary: Get a single template - metadata plus raw HTML body
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
 *         description: Template identifier matching the .html filename
 *     responses:
 *       200:
 *         description: Template metadata plus raw HTML
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
 *                   description: Editable content sections (greeting, body, cta_text, closing)
 *                   properties:
 *                     greeting: { type: string }
 *                     body: { type: string }
 *                     cta_text: { type: string }
 *                     closing: { type: string }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Template key not recognised or file missing from disk
 */
router.get("/:key", ctrl.getTemplate);

/**
 * @swagger
 * /api/email-templates/{key}:
 *   put:
 *     summary: Update a template's HTML body and save to disk (admin only)
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
 *                   greeting:
 *                     type: string
 *                     example: "Dear {{customerName}},"
 *                   body:
 *                     type: string
 *                     example: "Please find attached invoice {{invoiceNumber}}."
 *                   cta_text:
 *                     type: string
 *                     description: Button label. Empty string = no button (or note text for OTP template).
 *                     example: "View Invoice"
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
 *         description: html field missing or empty
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
