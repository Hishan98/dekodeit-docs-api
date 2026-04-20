-- =============================================================================
-- Dekode IT  |  Invoice & Proposal Management System
-- Database Schema  —  source of truth for fresh installs
--
-- Always reflects the current production table structure.
-- For upgrading an existing database see: database/migrations.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dekodeit_docs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dekodeit_docs;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id           INT          PRIMARY KEY AUTO_INCREMENT,
    email        VARCHAR(255) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    role         ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    avatar_url   VARCHAR(500) DEFAULT NULL
                     COMMENT 'Relative path to uploaded profile picture, e.g. /uploads/avatars/user-1.jpg',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role  (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Password Reset OTPs  (forgot-password flow)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id           INT       PRIMARY KEY AUTO_INCREMENT,
    email        VARCHAR(255) NOT NULL,
    otp          VARCHAR(6)   NOT NULL,
    attempts     INT  DEFAULT 0 COMMENT 'Number of failed verification attempts',
    max_attempts INT  DEFAULT 5 COMMENT 'Maximum allowed attempts',
    expires_at   TIMESTAMP NOT NULL,
    verified     BOOLEAN   DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email      (email),
    INDEX idx_otp        (otp),
    INDEX idx_expires_at (expires_at),
    INDEX idx_verified   (verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Services
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO services (id, name, description) VALUES
(1, 'Web Development',            'Custom web application development'),
(2, 'Mobile App Development',     'iOS and Android mobile application development'),
(3, 'UI/UX Designs & Branding',   'User interface design and branding services'),
(4, 'Social Media Marketing',     'Social media marketing and management'),
(5, 'Small Scale IOT Development','Internet of Things development services'),
(6, 'Support Agreement',          'Time-bounded support contracts — each renewal period creates a new project'),
(7, 'Professional Services',      'Post-delivery engagements such as feature additions, audits, or migrations — each scope creates a new project');

-- -----------------------------------------------------------------------------
-- Clients  (companies / organisations that Dekode IT works with)
--
-- Soft-delete lifecycle via `status`:
--   active   = normal, appears in all dropdowns
--   inactive = temporarily hidden from dropdowns, data intact
--   archived = permanently retired, data preserved for historical documents
--             (row is never physically deleted)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id           INT          PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(255) NOT NULL,
    website      VARCHAR(255) DEFAULT NULL,
    address      TEXT,
    vat_id       VARCHAR(100),
    notes        TEXT,
    status       ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
    created_by   INT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_company_name (company_name),
    INDEX idx_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Client Contacts  (people at a client company)
--
-- One client can have many contacts.
-- is_primary = TRUE marks the default recipient for emails / proposals.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_contacts (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    client_id   INT           NOT NULL,
    name        VARCHAR(255)  NOT NULL,
    job_title   VARCHAR(255)  DEFAULT NULL,
    email       VARCHAR(255)  DEFAULT NULL,
    phone       VARCHAR(50)   DEFAULT NULL,
    is_primary  BOOLEAN       DEFAULT FALSE,
    notes       TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_client  (client_id),
    INDEX idx_primary (is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Proposal Templates
-- html_content is stored as a file on disk; file_path points to it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_templates (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    file_path   VARCHAR(500) NOT NULL COMMENT 'Absolute path to uploads/html-templates/proposals/{id}.html',
    variables   TEXT         COMMENT 'JSON array of available template variables',
    created_by  INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Invoice Templates
-- html_content is stored as a file on disk; file_path points to it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_templates (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    file_path   VARCHAR(500) NOT NULL COMMENT 'Absolute path to uploads/html-templates/invoices/{id}.html',
    variables   TEXT         COMMENT 'JSON array of available template variables',
    created_by  INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Projects
--
-- client_id is nullable: archiving a client does not orphan the project.
-- The FK is ON DELETE SET NULL so a future hard-delete (if ever allowed) would
-- unassign rather than block.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id                         INT          PRIMARY KEY AUTO_INCREMENT,
    name                       VARCHAR(255) NOT NULL,
    description                TEXT,
    client_id                  INT          NULL,
    service_id                 INT,
    phase                      ENUM('draft','submitted','accepted','rejected',
                                    'kickoff','in progress','on hold',
                                    'cancelled','completed','support','closed')
                                   DEFAULT 'draft',
    total_amount               DECIMAL(15,2) DEFAULT 0.00,
    status                     ENUM('active','completed','cancelled') DEFAULT 'active',
    start_date                 DATE,
    end_date                   DATE,
    has_recurring_billing      BOOLEAN DEFAULT FALSE
                                   COMMENT 'If true, project requires monthly/yearly support billing',
    free_support_period_months INT     DEFAULT 0
                                   COMMENT 'Number of months of free support after project completion',
    purchase_order_url         VARCHAR(500)  DEFAULT NULL
                                   COMMENT 'Path to uploaded Purchase Order document',
    purchase_order_received_at DATETIME      DEFAULT NULL
                                   COMMENT 'Timestamp when PO was uploaded',
    created_by                 INT,
    created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id)   REFERENCES clients(id)   ON DELETE SET NULL,
    FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
    INDEX idx_client  (client_id),
    INDEX idx_phase   (phase),
    INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Proposals
--
-- client_id nullable for the same reason as projects.
-- html_content is no longer stored — the PDF (pdf_path) is the immutable artifact.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposals (
    id              INT          PRIMARY KEY AUTO_INCREMENT,
    proposal_number VARCHAR(50)  UNIQUE NOT NULL COMMENT 'Format: P251101',
    client_id       INT          NULL,
    project_id      INT,
    template_id     INT,
    subject         VARCHAR(255),
    total_amount    DECIMAL(15,2) NOT NULL,
    currency        VARCHAR(10)   DEFAULT 'LKR',
    valid_until     DATE,
    status          ENUM('draft','sent','revision_requested','resubmitted','accepted','declined','expired') DEFAULT 'draft',
    pdf_path        VARCHAR(500),
    notes           TEXT,
    created_by      INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id)   REFERENCES clients(id)            ON DELETE SET NULL,
    FOREIGN KEY (project_id)  REFERENCES projects(id)           ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES proposal_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)              ON DELETE SET NULL,
    INDEX idx_proposal_number  (proposal_number),
    INDEX idx_client           (client_id),
    INDEX idx_status           (status),
    INDEX idx_created_at       (created_at),
    INDEX idx_status_created   (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Payment Stages  (milestone breakdown inside a proposal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_stages (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    proposal_id INT           NOT NULL,
    stage_name  VARCHAR(255)  NOT NULL,
    percentage  DECIMAL(5,2)  NOT NULL COMMENT 'Percentage of total amount',
    amount      DECIMAL(15,2) NOT NULL,
    due_date    DATE,
    status      ENUM('pending','paid','overdue') DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
    INDEX idx_proposal (proposal_id),
    INDEX idx_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Invoices
--
-- client_id nullable — same rationale as projects/proposals.
-- html_content is no longer stored — the PDF (pdf_path) is the immutable artifact.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id              INT           PRIMARY KEY AUTO_INCREMENT,
    invoice_number  VARCHAR(50)   UNIQUE NOT NULL COMMENT 'Format: D251101',
    client_id       INT           NULL,
    project_id      INT,
    proposal_id     INT,
    template_id     INT,
    subject         VARCHAR(255),
    total_amount    DECIMAL(15,2) NOT NULL,
    currency        VARCHAR(10)   DEFAULT 'LKR',
    tax_amount      DECIMAL(15,2) DEFAULT 0.00,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    final_amount    DECIMAL(15,2) NOT NULL,
    due_date        DATE,
    status          ENUM('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
    pdf_path        VARCHAR(500),
    notes           TEXT,
    created_by      INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id)   REFERENCES clients(id)            ON DELETE SET NULL,
    FOREIGN KEY (project_id)  REFERENCES projects(id)           ON DELETE SET NULL,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id)          ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES invoice_templates(id)  ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)              ON DELETE SET NULL,
    INDEX idx_invoice_number  (invoice_number),
    INDEX idx_client          (client_id),
    INDEX idx_status          (status),
    INDEX idx_due_date        (due_date),
    INDEX idx_created_at      (created_at),
    INDEX idx_status_created  (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id               INT           PRIMARY KEY AUTO_INCREMENT,
    invoice_id       INT,
    proposal_id      INT,
    project_id       INT,
    payment_type     ENUM('advance','interim','final',
                          'broker_commission','developer_payment','recurring') NOT NULL,
    amount           DECIMAL(15,2) NOT NULL,
    payment_date     DATE          NOT NULL,
    payment_method   VARCHAR(100),
    reference_number VARCHAR(255),
    description      TEXT,
    recipient_name   VARCHAR(255)  COMMENT 'For broker/developer payments',
    recipient_type   ENUM('broker','developer','company') DEFAULT 'company',
    created_by       INT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id)  REFERENCES invoices(id)  ON DELETE SET NULL,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
    INDEX idx_invoice      (invoice_id),
    INDEX idx_proposal     (proposal_id),
    INDEX idx_project      (project_id),
    INDEX idx_payment_type (payment_type),
    INDEX idx_payment_date (payment_date),
    INDEX idx_created_at   (created_at),
    INDEX idx_project_type (project_id, payment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Recurring Bills
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recurring_bills (
    id                INT           PRIMARY KEY AUTO_INCREMENT,
    project_id        INT           NOT NULL,
    client_id         INT           NOT NULL,
    service_id        INT,
    amount            DECIMAL(15,2) NOT NULL,
    frequency         ENUM('monthly','annually') NOT NULL,
    start_date        DATE          NOT NULL,
    end_date          DATE,
    next_billing_date DATE          NOT NULL,
    status            ENUM('active','paused','cancelled') DEFAULT 'active',
    auto_generate     BOOLEAN DEFAULT TRUE,
    created_by        INT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY (client_id)  REFERENCES clients(id)  ON DELETE RESTRICT,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL,
    INDEX idx_project      (project_id),
    INDEX idx_client       (client_id),
    INDEX idx_next_billing (next_billing_date),
    INDEX idx_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Invoice Line Items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    invoice_id  INT           NOT NULL,
    description TEXT          NOT NULL,
    quantity    DECIMAL(10,2) DEFAULT 1.00,
    unit_price  DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Proposal Line Items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_line_items (
    id          INT           PRIMARY KEY AUTO_INCREMENT,
    proposal_id INT           NOT NULL,
    description TEXT          NOT NULL,
    quantity    DECIMAL(10,2) DEFAULT 1.00,
    unit_price  DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
    INDEX idx_proposal (proposal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Design Document Templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS design_document_templates (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    file_path   VARCHAR(500) NOT NULL COMMENT 'Path to uploaded .docx template file',
    created_by  INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Design Documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS design_documents (
    id              INT          PRIMARY KEY AUTO_INCREMENT,
    document_number VARCHAR(50)  UNIQUE NOT NULL COMMENT 'Format: DD192345',
    project_id      INT          NOT NULL,
    subject         VARCHAR(255),
    file_path       VARCHAR(500) NOT NULL COMMENT 'Path to uploaded .docx file',
    status          ENUM('draft','sent','accepted','rejected') DEFAULT 'draft',
    notes           TEXT,
    created_by      INT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL,
    INDEX idx_document_number (document_number),
    INDEX idx_project         (project_id),
    INDEX idx_status          (status),
    INDEX idx_created_at      (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Service Agreement Templates
-- html_content is stored as a file on disk; file_path points to it.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_agreement_templates (
    id          INT          PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    file_path   VARCHAR(500) NOT NULL COMMENT 'Absolute path to uploads/html-templates/service-agreements/{id}.html',
    variables   TEXT         COMMENT 'JSON array of available template variables',
    created_by  INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Service Agreements
-- html_content is no longer stored — the PDF (pdf_path) is the immutable artifact.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_agreements (
    id               INT          PRIMARY KEY AUTO_INCREMENT,
    agreement_number VARCHAR(50)  UNIQUE NOT NULL COMMENT 'Format: S192345',
    project_id       INT          NOT NULL,
    template_id      INT,
    subject          VARCHAR(255),
    pdf_path         VARCHAR(500),
    status           ENUM('draft','sent','revision_requested','resubmitted','signed','rejected') DEFAULT 'draft',
    notes            TEXT,
    created_by       INT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id)  REFERENCES projects(id)                    ON DELETE RESTRICT,
    FOREIGN KEY (template_id) REFERENCES service_agreement_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)                       ON DELETE SET NULL,
    INDEX idx_agreement_number (agreement_number),
    INDEX idx_project          (project_id),
    INDEX idx_status           (status),
    INDEX idx_created_at       (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Numbering Sequences  (invoice, proposal, design-document, service-agreement)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS numbering_sequences (
    id          INT         PRIMARY KEY AUTO_INCREMENT,
    type        ENUM('invoice','proposal','design_document','service_agreement') NOT NULL,
    prefix      VARCHAR(10) NOT NULL COMMENT 'D, P, DD, or S',
    year        INT         NOT NULL,
    month       INT         NOT NULL,
    sequence    INT         NOT NULL DEFAULT 0,
    last_number VARCHAR(50),
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_type_year_month (type, year, month),
    INDEX idx_type       (type),
    INDEX idx_year_month (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
