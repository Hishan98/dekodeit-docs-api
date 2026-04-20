-- =============================================================================
-- Dekode IT  |  Invoice & Proposal Management System
-- Migration History  —  for upgrading an existing database
--
-- Run these statements against an already-running database.
-- Each block is idempotent (safe to re-run).
-- Fresh installs should use schema.sql instead.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [2025-xx]  Profile picture support
-- Adds avatar_url to users so staff/admin can upload a profile photo.
-- -----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT NULL
        COMMENT 'Relative path to uploaded profile picture, e.g. /uploads/avatars/user-1.jpg';


-- -----------------------------------------------------------------------------
-- [2025-xx]  Performance indexes
-- Composite indexes for dashboard/analytics queries.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_status_created  ON invoices  (status, created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_status_created ON proposals (status, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_created_at      ON payments  (created_at);
CREATE INDEX IF NOT EXISTS idx_payments_project_type    ON payments  (project_id, payment_type);


-- -----------------------------------------------------------------------------
-- [2025-xx]  Nullable customer_id on linked tables
-- Allows customer rows to be archived (soft-deleted) without orphaning their
-- invoices, proposals, or projects.  Those records become "unassigned" if the
-- customer FK is ever set to NULL (not currently done — kept for safety).
-- -----------------------------------------------------------------------------
ALTER TABLE projects
    MODIFY COLUMN customer_id INT NULL;

ALTER TABLE invoices
    MODIFY COLUMN customer_id INT NULL;

ALTER TABLE proposals
    MODIFY COLUMN customer_id INT NULL;

-- Update FK constraint to SET NULL on delete (was RESTRICT).
-- Requires dropping and re-adding the constraint.
-- Skip if your version of MySQL/MariaDB does not support IF EXISTS on constraints.

-- projects
ALTER TABLE projects
    DROP FOREIGN KEY IF EXISTS projects_ibfk_1;        -- adjust name if different
ALTER TABLE projects
    ADD CONSTRAINT fk_projects_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- invoices
ALTER TABLE invoices
    DROP FOREIGN KEY IF EXISTS invoices_ibfk_1;
ALTER TABLE invoices
    ADD CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- proposals
ALTER TABLE proposals
    DROP FOREIGN KEY IF EXISTS proposals_ibfk_1;
ALTER TABLE proposals
    ADD CONSTRAINT fk_proposals_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- [2025-xx]  Customer lifecycle status (soft delete)
-- Replaces hard DELETE with an ENUM status column.
--   active   = normal, appears in all dropdowns
--   inactive = temporarily hidden from dropdowns
--   archived = permanently retired, data preserved for historical documents
-- -----------------------------------------------------------------------------
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS status
        ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);


-- -----------------------------------------------------------------------------
-- [2026-04]  Purchase Order support on projects
-- Adds fields to track when a PO has been received from the customer,
-- which gates invoice generation in the project workflow.
-- -----------------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS purchase_order_url VARCHAR(500) DEFAULT NULL
        COMMENT 'Path to uploaded Purchase Order document',
    ADD COLUMN IF NOT EXISTS purchase_order_received_at DATETIME DEFAULT NULL
        COMMENT 'Timestamp when PO was uploaded';


-- -----------------------------------------------------------------------------
-- [2026-04]  Proposal revision workflow
-- Adds revision_requested and resubmitted status values so proposals can
-- go through a back-and-forth revision cycle before acceptance.
-- -----------------------------------------------------------------------------
ALTER TABLE proposals
    MODIFY COLUMN status
        ENUM('draft','sent','revision_requested','resubmitted','accepted','declined','expired')
        DEFAULT 'draft';


-- -----------------------------------------------------------------------------
-- [2026-04]  Service Agreement revision workflow
-- Aligns SA status values with the proposal revision cycle.
-- -----------------------------------------------------------------------------
ALTER TABLE service_agreements
    MODIFY COLUMN status
        ENUM('draft','sent','revision_requested','resubmitted','signed','rejected')
        DEFAULT 'draft';


-- -----------------------------------------------------------------------------
-- [2026-04]  Template file storage migration
--
-- Moves HTML template content out of the database and onto disk.
-- Templates are now stored as .html files under uploads/html-templates/.
-- The PDF is the only immutable artifact kept per document.
--
-- HOW TO APPLY:
--   1. Run scripts/migrate-templates.js FIRST — it writes existing html_content
--      to files and sets file_path on every template row.
--   2. Then run the ALTER statements below to drop the old columns.
--   3. Fresh installs should use schema.sql instead (already updated).
-- -----------------------------------------------------------------------------

-- Step 1: add file_path to template tables (nullable during migration window)
ALTER TABLE proposal_templates
    ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) DEFAULT NULL
        COMMENT 'Absolute path to uploads/html-templates/proposals/{id}.html';

ALTER TABLE invoice_templates
    ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) DEFAULT NULL
        COMMENT 'Absolute path to uploads/html-templates/invoices/{id}.html';

ALTER TABLE service_agreement_templates
    ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) DEFAULT NULL
        COMMENT 'Absolute path to uploads/html-templates/service-agreements/{id}.html';

-- Step 2 (run AFTER scripts/migrate-templates.js):
-- Drop html_content from template tables
ALTER TABLE proposal_templates         DROP COLUMN IF EXISTS html_content;
ALTER TABLE invoice_templates          DROP COLUMN IF EXISTS html_content;
ALTER TABLE service_agreement_templates DROP COLUMN IF EXISTS html_content;

-- Step 3: drop html_content from document tables (PDF is the artifact)
ALTER TABLE proposals         DROP COLUMN IF EXISTS html_content;
ALTER TABLE invoices          DROP COLUMN IF EXISTS html_content;
ALTER TABLE service_agreements DROP COLUMN IF EXISTS html_content;
