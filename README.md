# 📄 Dekode IT Docs API

> **A comprehensive backend API for managing invoices, proposals, design documents, service agreements, and project workflows.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Authentication](#-authentication)
- [Document Types](#-document-types)
- [Project Phases](#-project-phases)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Overview

Dekode IT Docs API is a robust RESTful API built with Node.js and Express.js for managing business documents, projects, and workflows. It provides comprehensive functionality for creating and managing invoices, proposals, design documents, service agreements, and tracking project lifecycles.

### Key Capabilities

- 📊 **Document Management** - Create, update, and track invoices, proposals, design documents, and service agreements
- 🔐 **Secure Authentication** - JWT-based authentication with role-based access control
- 📄 **PDF Generation** - Automatic PDF generation for documents using Puppeteer
- 📤 **File Uploads** - Support for .docx file uploads for design document templates
- 🔢 **Auto-numbering** - Automatic sequential numbering for all document types
- 📈 **Project Tracking** - Comprehensive project management with 11 phase states
- 💰 **Payment Management** - Track payments, commissions, and recurring billing
- 📧 **Email Integration** - Send documents via email with OTP-based password reset
- 📊 **Reporting** - Generate revenue reports and analytics with Excel export

## ✨ Features

### Core Features

- ✅ **JWT Authentication** - Secure token-based authentication for all endpoints
- ✅ **Role-based Access Control** - Admin and staff roles with different permissions
- ✅ **Auto-numbering System** - Automatic document numbering with year/month/sequence format
- ✅ **PDF Generation** - Automatic PDF generation using Puppeteer
- ✅ **File Upload Support** - Upload and manage .docx files for design documents
- ✅ **Payment Tracking** - Track payments with broker commission and developer payment support
- ✅ **Project Management** - Comprehensive project tracking with 11 phase states
- ✅ **Recurring Billing** - Automated recurring billing support
- ✅ **Excel Export** - Export reports to Excel format
- ✅ **Swagger Documentation** - Interactive API documentation
- ✅ **Forgot Password Flow** - OTP-based password reset with email verification
- ✅ **Template System** - Flexible template system with variable replacement

### Document Types

| Document Type | Numbering Format | Status Options |
|--------------|------------------|----------------|
| **Invoices** | `D251101` | draft, sent, paid, overdue, cancelled |
| **Proposals** | `P251101` | draft, sent, accepted, declined, expired |
| **Design Documents** | `DD192345` | draft, sent, accepted, rejected |
| **Service Agreements** | `S192345` | pending, signed, rejected |

## 🛠 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.1
- **Database:** MySQL 8.0
- **Authentication:** JWT (jsonwebtoken)
- **PDF Generation:** Puppeteer
- **File Upload:** Multer
- **Email:** Nodemailer
- **Validation:** Joi
- **Documentation:** Swagger/OpenAPI 3.0
- **Security:** Helmet, CORS, Rate Limiting

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MySQL** (v8.0 or higher)
- **Git**

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd dekodeit-docs-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=dekodeit_docs

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Email Configuration (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@dekodeit.com
```

> ⚠️ **Security Note:** Never commit your `.env` file to version control. Change all default values in production.

## 🗄 Database Setup

### 1. Create Database and Run Schema

```bash
mysql -u root -p < database/schema.sql
```

The schema includes:
- ✅ User authentication tables
- ✅ Customer management
- ✅ Project tracking with 11 phase states
- ✅ Invoice and proposal management
- ✅ Design document templates and documents
- ✅ Service agreement templates and agreements
- ✅ Payment tracking
- ✅ Recurring billing support
- ✅ Password reset OTP system

### 2. (Optional) Load Sample Data

```bash
mysql -u root -p dekodeit_docs < database/seed.sql
```

This will populate the database with:
- Sample users (admin and staff)
- Sample customers
- Sample projects
- Sample templates
- Sample documents

### 3. Create Initial Admin User

Run in MySQL or use the provided script:

```sql
INSERT INTO users (email, password, name, role) 
VALUES ('admin@dekodeit.com', '$2a$10$YourHashedPasswordHere', 'Admin User', 'admin');
```

**To generate a password hash:**

```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('yourpassword', 10);
console.log(hash);
```

Or use the provided script:

```bash
node scripts/create-admin.js
```

## ▶️ Running the Application

### Development Mode

```bash
npm run dev
```

The API will be available at:
- **API Base URL:** `http://localhost:5000`
- **API Documentation:** `http://localhost:5000/api-docs`
- **Health Check:** `http://localhost:5000/health`

### Production Mode

```bash
npm start
```

## 📚 API Documentation

### Interactive Documentation

Visit `http://localhost:5000/api-docs` for interactive Swagger documentation with:
- Complete endpoint descriptions
- Request/response schemas
- Try-it-out functionality
- Authentication testing

### Authentication

> **Note:** All endpoints (except login and forgot password) require JWT authentication. Include the token in the Authorization header: `Bearer <token>`

#### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | User login |
| `GET` | `/api/auth/me` | Get current user |
| `PUT` | `/api/auth/profile` | Update user profile |
| `PUT` | `/api/auth/change-password` | Change password |
| `POST` | `/api/auth/forgot-password` | Send OTP to email |
| `POST` | `/api/auth/verify-otp` | Verify OTP |
| `POST` | `/api/auth/reset-password` | Reset password |

### Core Endpoints

#### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer (Admin only)
- `PUT /api/customers/:id` - Update customer (Admin only)
- `DELETE /api/customers/:id` - Delete customer (Admin only)

#### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `PUT /api/projects/:id/phase` - Update project phase only
- `DELETE /api/projects/:id` - Delete project

#### Proposals
- `GET /api/proposals` - List all proposals
- `GET /api/proposals/:id` - Get proposal by ID
- `POST /api/proposals` - Create proposal
- `PUT /api/proposals/:id` - Update proposal
- `DELETE /api/proposals/:id` - Delete proposal
- `GET /api/proposals/:id/pdf` - Download PDF

#### Invoices
- `GET /api/invoices` - List all invoices
- `GET /api/invoices/:id` - Get invoice by ID
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `GET /api/invoices/:id/pdf` - Download PDF

#### Design Documents
- `GET /api/design-documents` - List all design documents
- `GET /api/design-documents/:id` - Get design document by ID
- `POST /api/design-documents` - Create design document (multipart/form-data)
- `PUT /api/design-documents/:id` - Update design document
- `PUT /api/design-documents/:id/status` - Update status only
- `DELETE /api/design-documents/:id` - Delete design document (Admin only)
- `GET /api/design-documents/:id/download` - Download .docx file

**Status Values:** `draft`, `sent`, `accepted`, `rejected`

#### Service Agreements
- `GET /api/service-agreements` - List all service agreements
- `GET /api/service-agreements/:id` - Get service agreement by ID
- `POST /api/service-agreements` - Create service agreement
- `PUT /api/service-agreements/:id` - Update service agreement
- `PUT /api/service-agreements/:id/status` - Update status only
- `DELETE /api/service-agreements/:id` - Delete service agreement (Admin only)
- `GET /api/service-agreements/:id/pdf` - Download PDF

**Status Values:** `pending`, `signed`, `rejected`

#### Templates
- `GET /api/templates/proposals` - List proposal templates
- `GET /api/templates/invoices` - List invoice templates
- `GET /api/templates/design-documents` - List design document templates
- `GET /api/templates/service-agreements` - List service agreement templates
- `POST /api/templates/*` - Create template (Admin only)
- `PUT /api/templates/*/:id` - Update template (Admin only)
- `DELETE /api/templates/*/:id` - Delete template (Admin only)

#### Payments
- `GET /api/payments` - List all payments
- `GET /api/payments/:id` - Get payment by ID
- `POST /api/payments` - Create payment
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment
- `GET /api/payments/project/:projectId` - Get project payments

#### Reports
- `GET /api/reports/revenue` - Revenue report
- `GET /api/reports/payments` - Payment status report
- `GET /api/reports/analytics` - Analytics data
- `GET /api/reports/export?type=revenue|payments` - Export to Excel

## 📁 Project Structure

```
dekodeit-docs-api/
├── database/
│   ├── schema.sql          # Database schema
│   ├── seed.sql            # Sample data
│   └── README.md           # Database documentation
├── src/
│   ├── app.js              # Application entry point
│   ├── config/
│   │   └── database.js     # Database configuration
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Custom middleware
│   │   ├── auth.js         # JWT authentication
│   │   ├── roleCheck.js    # Role-based access control
│   │   ├── rateLimiter.js  # Rate limiting
│   │   └── upload.js       # File upload handling
│   ├── routes/             # API routes
│   ├── services/           # Business logic services
│   │   ├── emailService.js
│   │   ├── pdfService.js
│   │   └── numberingService.js
│   └── utils/              # Utility functions
├── uploads/                # Uploaded files
│   ├── pdfs/
│   ├── design-documents/
│   └── templates/
├── scripts/                # Utility scripts
├── .env                    # Environment variables (not in repo)
├── .gitignore
├── package.json
└── README.md
```

## 🔐 Authentication

### Login Example

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dekodeit.com",
    "password": "yourpassword"
  }'
```

### Using the Token

```bash
curl -X GET http://localhost:5000/api/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📄 Document Types

### Auto-numbering Format

All documents use a consistent numbering format: `PREFIX + YYMM + SEQUENCE`

- **Invoices:** `D251101` (D + 25 + 11 + 01)
- **Proposals:** `P251101` (P + 25 + 11 + 01)
- **Design Documents:** `DD192345` (DD + 19 + 23 + 45)
- **Service Agreements:** `S192345` (S + 19 + 23 + 45)

### Design Document Workflow

1. **Upload Template** - Admin uploads .docx template via `/api/templates/design-documents`
2. **Download Template** - User downloads template from system
3. **Edit Locally** - User edits template on computer (add screenshots, content)
4. **Upload Document** - User uploads edited .docx via `/api/design-documents`
5. **Track Status** - Update status through workflow: `draft` → `sent` → `accepted`/`rejected`

### Service Agreement Templates

Service agreements use HTML templates with variable replacement:

**Available Variables:**
- `{{agreement_number}}` - Agreement number
- `{{date}}` - Current date
- `{{customer.name}}` - Customer name
- `{{customer.email}}` - Customer email
- `{{customer.phone}}` - Customer phone
- `{{customer.company}}` - Customer company
- `{{customer.address}}` - Customer address
- `{{project.name}}` - Project name
- `{{agreement.subject}}` - Agreement subject

## 🎯 Project Phases

Projects progress through the following lifecycle phases:

| Phase | Description |
|-------|-------------|
| `draft` | Initial project draft (default) |
| `submitted` | Project proposal submitted |
| `accepted` | Project proposal accepted |
| `rejected` | Project proposal rejected |
| `kickoff` | Project kickoff started |
| `in progress` | Project in active development |
| `on hold` | Project temporarily paused |
| `cancelled` | Project cancelled |
| `completed` | Project completed |
| `support` | Project in support/maintenance phase |
| `closed` | Project closed |

**Quick Status Update:**
```bash
PUT /api/projects/:id/phase
Body: { "phase": "accepted" }
```

## 🧪 Testing

### Health Check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run seed` | Generate seed data |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ES6+ syntax
- Follow existing code patterns
- Add JSDoc comments for new functions
- Update Swagger documentation for new endpoints

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

For support, email support@dekodeit.com or create an issue in the repository.

---

**Built with ❤️ by Dekode IT**
