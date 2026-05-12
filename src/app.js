const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Fail fast if required secrets are missing — never fall back to weak defaults
const REQUIRED_ENV = ["JWT_SECRET", "DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

// Ensure uploads/avatars directory exists
const avatarsDir = path.join(__dirname, "..", "uploads", "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();
const PORT = process.env.PORT || 5000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dekode IT Docs API",
      version: "1.0.0",
      description:
        "Invoice, Proposal, Design Document, and Service Agreement Management System API. Features include JWT authentication, role-based access control, auto-numbering, PDF generation, file uploads, and comprehensive document tracking.",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: [
    "./src/routes/*.js",
    "./src/controllers/*.js",
    "./routes/*.js",
    "./controllers/*.js",
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
// crossOriginResourcePolicy is set to cross-origin so that static assets
// (uploaded files, avatars) can be loaded by the Next.js frontend on a
// different port/origin. helmet's default "same-origin" blocks cross-origin
// <img> loads even when CORS is open.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(morgan("dev"));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes at full speed
  delayMs: () => 500, // add 500ms delay per request after delayAfter (v2 syntax)
});

app.use("/api/", limiter);
app.use("/api/", speedLimiter);

// Serve uploaded files - cross-origin explicitly allowed so the frontend
// (different port) can load avatars and other assets as <img> tags.
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    maxAge: "7d",
    etag: true,
  })
);

// Swagger documentation — only available outside production
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/clients", require("./routes/clients"));
app.use("/api/proposals", require("./routes/proposals"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/templates", require("./routes/templates"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/services", require("./routes/services"));
app.use("/api/recurring-bills", require("./routes/recurringBills"));
app.use("/api/design-documents", require("./routes/designDocuments"));
app.use("/api/service-agreements", require("./routes/serviceAgreements"));
app.use("/api/notifications",    require("./routes/notifications"));
app.use("/api/email-templates",  require("./routes/emailTemplates"));

// Health check — public, minimal response (no server internals)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler — never expose stack traces in responses
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// Start recurring bills cron job
if (process.env.ENABLE_RECURRING_BILLS_CRON !== "false") {
  const { startRecurringBillsCron } = require("./cron/recurringBills");
  startRecurringBillsCron();
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);

  // Verify SMTP on startup - logs a warning if misconfigured, never crashes the server
  const { verifyConnection } = require("./services/emailService");
  verifyConnection();
});

module.exports = app;
