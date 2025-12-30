const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const authenticate = require("../middleware/auth");

router.use(authenticate);

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Get all services
 *     description: Retrieves a list of all available services. Returns distinct services ordered by name to avoid duplicates.
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved list of services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "Web Development"
 *                       description:
 *                         type: string
 *                         nullable: true
 *                         example: "Custom web application development"
 *             example:
 *               services:
 *                 - id: 1
 *                   name: "Web Development"
 *                   description: "Custom web application development"
 *                 - id: 2
 *                   name: "Mobile App"
 *                   description: "Mobile application development"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/", async (req, res) => {
  try {
    const [services] = await pool.execute(
      // Use DISTINCT to avoid duplicated service rows (same id/name) showing multiple times
      "SELECT DISTINCT id, name, description FROM services ORDER BY name ASC"
    );
    res.json({ services });
  } catch (error) {
    console.error("Get services error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
