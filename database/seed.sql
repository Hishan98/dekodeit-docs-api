-- =============================================================================
-- Dekode IT  |  Invoice & Proposal Management System
-- Seed Data  -  minimal demo data for development / staging
--
-- Run AFTER schema.sql on a fresh database.
-- Do NOT run on production.
-- Services (id 1-5) are seeded by schema.sql via INSERT IGNORE.
--
-- Template seeding (proposal, invoice, service-agreement) is handled by
-- scripts/seed-template-files.js, which creates the .html files on disk and
-- inserts the template rows with correct absolute file_path values.
-- Run that script AFTER this file:
--   node scripts/seed-template-files.js
--
-- Email notification templates are NOT seeded here. Each template is stored as
-- two companion files under src/emailTemplates/:
--   <key>.json  - editable sections (subject, greeting, body, closing)
--   <key>.html  - full HTML assembled from sections, used for sending
-- The .html files ship with the codebase. .json files are created on first save
-- via Settings > Emails in the UI (PUT /api/email-templates/:key). If a .json
-- file is absent the controller falls back to hardcoded defaults.
--
-- Demo projects cover every workflow stage so the UI can be tested end-to-end:
--   Project 1  kickoff      - full workflow complete (PO received, invoice sent)
--   Project 2  accepted     - proposal accepted, awaiting Purchase Order
--   Project 3  completed    - project finished, all documents done
--   Project 4  submitted    - documents sent, awaiting customer acceptance
--   Project 5  draft        - brand-new project, no documents yet
--   Project 6  completed    - Support Agreement: expired Q1 3-month contract
--   Project 7  kickoff      - Support Agreement: active 12-month renewal (new project per period)
--   Project 8  submitted    - Professional Services: post-delivery feature engagement
--   Project 9  cancelled    - ERP Portal cancelled mid-kickoff (tests cancel/restore UI flow)
-- =============================================================================

USE dekodeit_docs;

-- =============================================================================
-- Clean slate - truncate every seed table and reset AUTO_INCREMENT to 1.
-- This makes the file safe to re-run as many times as needed.
-- FK checks are disabled only for the duration of the TRUNCATE block.
-- =============================================================================
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE payments;
TRUNCATE TABLE invoice_line_items;
TRUNCATE TABLE proposal_line_items;
TRUNCATE TABLE payment_stages;
TRUNCATE TABLE recurring_bills;
TRUNCATE TABLE invoices;
TRUNCATE TABLE service_agreements;
TRUNCATE TABLE proposals;
TRUNCATE TABLE design_documents;
TRUNCATE TABLE projects;
TRUNCATE TABLE service_agreement_templates;
TRUNCATE TABLE invoice_templates;
TRUNCATE TABLE proposal_templates;
TRUNCATE TABLE design_document_templates;
TRUNCATE TABLE numbering_sequences;
TRUNCATE TABLE client_contacts;
TRUNCATE TABLE clients;
TRUNCATE TABLE services;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Services  (must be inserted before projects due to FK)
-- Mirrors the INSERT IGNORE block in schema.sql so this file is self-contained.
-- -----------------------------------------------------------------------------
INSERT INTO services (id, name, description) VALUES
(1, 'Web Development',             'Custom web application development'),
(2, 'Mobile App Development',      'iOS and Android mobile application development'),
(3, 'UI/UX Designs & Branding',    'User interface design and branding services'),
(4, 'Social Media Marketing',      'Social media marketing and management'),
(5, 'Small Scale IOT Development', 'Internet of Things development services'),
(6, 'Support Agreement',           'Time-bounded support contracts - each renewal period creates a new project'),
(7, 'Professional Services',       'Post-delivery engagements such as feature additions, audits, or migrations - each scope creates a new project');

-- -----------------------------------------------------------------------------
-- Users
-- Demo accounts are seeded with bcrypt hashes only.
-- Reset all passwords via the UI or CLI before going to production.
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, password, name, role) VALUES
(1, 'admin@dekodeit.com', '$2b$10$8JkexIV9NAHFrOIZ5tPJH.bK2.fKIyUwPmW2WOT55IQA/OW7Rl9ii', 'Admin User', 'admin'),
(2, 'staff@dekodeit.com', '$2b$10$8JkexIV9NAHFrOIZ5tPJH.bK2.fKIyUwPmW2WOT55IQA/OW7Rl9ii', 'Staff User', 'staff'),
(3, 'lasni@dekodeit.com', '$2b$10$KoHxplJq/XeDa9rJ9qjjRecdEiYHFGZCkcMlL6e1DJLdQlTRqipEq', 'Dulara', 'admin');

-- -----------------------------------------------------------------------------
-- Clients  (8 companies: 6 active · 1 inactive · 1 archived)
-- -----------------------------------------------------------------------------
INSERT INTO clients (id, company_name, address, vat_id, notes, status, created_by) VALUES
(1, 'ABC Corporation',       '123 Business Street, Colombo 05', 'TAX001234', 'Regular client, prefers email communication',  'active',   1),
(2, 'Tech Solutions Lanka',  '456 Tech Park, Kandy',            'TAX005678', 'Monthly support client',                      'active',   1),
(3, 'Global Enterprises',    '789 International Road, Galle',   'TAX009012', 'Large-scale project client',                  'active',   1),
(4, 'Startup Innovations',   '321 Innovation Hub, Negombo',     NULL,        'New startup, flexible payment terms agreed',  'active',   1),
(5, 'Digital Marketing Pro', '654 Digital Avenue, Jaffna',      'TAX012345', 'Social media marketing client',               'active',   1),
(6, 'Retail Plus Ltd',       '789 Shopping Complex, Kurunegala','TAX015678', 'E-commerce platform client',                  'active',   1),
(7, 'Old Media Group',       '99 Sunset Blvd, Colombo 03',      'TAX071111', 'Contract paused, renewal pending',            'inactive', 1),
(8, 'Legacy Systems Ltd',    '10 Archive Road, Galle',          'TAX072222', 'Company dissolved, archived for records only','archived', 1);

-- -----------------------------------------------------------------------------
-- Client Contacts  (one primary contact per client)
-- -----------------------------------------------------------------------------
INSERT INTO client_contacts (client_id, name, job_title, email, phone, is_primary) VALUES
(1, 'John Smith',     'CEO',                 'john.smith@example.com',   '+94 77 123 4567', TRUE),
(2, 'Sarah Johnson',  'Project Manager',     'sarah.j@techsolutions.lk', '+94 11 234 5678', TRUE),
(3, 'Michael Chen',   'Director',            'michael.chen@global.com',  '+94 77 345 6789', TRUE),
(4, 'Emma Williams',  'Co-Founder',          'emma.w@startup.io',        '+94 11 456 7890', TRUE),
(5, 'David Brown',    'Marketing Manager',   'david.brown@digital.lk',   '+94 77 567 8901', TRUE),
(6, 'Lisa Anderson',  'Operations Manager',  'lisa.anderson@retail.com', '+94 11 678 9012', TRUE),
(7, 'Nathan Brooks',  'Managing Director',   'nathan.b@oldmedia.lk',     '+94 77 111 2233', TRUE),
(8, 'Victoria Cross', 'Chief Executive',     'victoria.c@legacy.lk',     '+94 11 444 5566', TRUE);

-- -----------------------------------------------------------------------------
-- Templates (proposal, invoice, service-agreement)
-- Rows are inserted here with file_path = '' as a placeholder so that FK
-- constraints on proposals/invoices/service_agreements are satisfied.
-- Run scripts/seed-template-files.js after this file to write the .html
-- files to disk and fill in the correct absolute file_path values.
-- -----------------------------------------------------------------------------
INSERT INTO proposal_templates (id, name, description, file_path, variables, created_by) VALUES
(1, 'Standard Proposal Template', 'Default proposal template for Dekode IT', '',
 '["proposal_number","date","customer.name","customer.email","customer.phone","customer.company","customer.address","proposal.total_amount","proposal.currency","proposal.valid_until","proposal.subject"]',
 1);

INSERT INTO invoice_templates (id, name, description, file_path, variables, created_by) VALUES
(1, 'Standard Invoice Template', 'Default invoice template for Dekode IT', '',
 '["invoice_number","date","customer.name","customer.email","customer.phone","customer.company","customer.address","customer.vat_id","invoice.total_amount","invoice.tax_amount","invoice.discount_amount","invoice.final_amount","invoice.currency","invoice.due_date","invoice.subject"]',
 1);

INSERT INTO service_agreement_templates (id, name, description, file_path, variables, created_by) VALUES
(1, 'Standard Service Agreement', 'Default service agreement template', '',
 '["agreement_number","date","customer.name","customer.email","customer.phone","customer.company","customer.address","project.name","agreement.subject"]',
 1);

-- -----------------------------------------------------------------------------
-- Design Document Template
-- -----------------------------------------------------------------------------
INSERT INTO design_document_templates (id, name, description, file_path, created_by) VALUES
(1, 'Standard Design Document Template', 'Default template for design documents', 'uploads/templates/dd-template-standard.docx', 1);

-- -----------------------------------------------------------------------------
-- Projects  (5 - one per workflow stage)
--
-- Phase     | Workflow stage
-- --------- | -----------------------------------------------------------
-- kickoff   | Full workflow done - PO received, invoice sent, work started
-- accepted  | Proposal accepted, waiting for Purchase Order
-- completed | Project fully delivered and closed
-- submitted | Documents sent, awaiting customer acceptance
-- draft     | Brand-new project, no documents yet
-- -----------------------------------------------------------------------------
INSERT INTO projects
    (id, name, description, client_id, service_id, phase, currency, total_amount, status,
     purchase_order_url, purchase_order_received_at, start_date, created_by)
VALUES
(
    1, 'E-Commerce Website',
    'Full-stack e-commerce platform with payment gateway integration',
    1, 1, 'kickoff', 'LKR', 500000.00, 'active',
    'uploads/purchase-orders/po-ecommerce-abc.pdf',
    DATE_SUB(NOW(), INTERVAL 5 DAY),
    DATE_SUB(CURDATE(), INTERVAL 10 DAY), 1
),
(
    2, 'Mobile Banking App',
    'iOS and Android mobile banking application for Tech Solutions Lanka',
    2, 2, 'accepted', 'LKR', 750000.00, 'active',
    NULL, NULL,
    DATE_SUB(CURDATE(), INTERVAL 20 DAY), 1
),
(
    3, 'Brand Identity & Guidelines',
    'Complete branding package. Logo, style guide, and marketing collateral',
    3, 3, 'completed', 'LKR', 150000.00, 'completed',
    'uploads/purchase-orders/po-brand-global.pdf',
    DATE_SUB(NOW(), INTERVAL 45 DAY),
    DATE_SUB(CURDATE(), INTERVAL 60 DAY), 1
),
(
    4, 'Retail Management System',
    'Inventory, sales, and reporting platform for Retail Plus Ltd',
    6, 1, 'submitted', 'LKR', 400000.00, 'active',
    NULL, NULL,
    DATE_SUB(CURDATE(), INTERVAL 5 DAY), 1
),
(
    5, 'Social Media Marketing Campaign',
    '3-month social media strategy and content marketing campaign',
    5, 4, 'draft', 'LKR', 120000.00, 'active',
    NULL, NULL,
    CURDATE(), 1
),
-- ── Support Agreement - closed period + active renewal ────────────────────
-- Project 6: the original 3-month support agreement that has now ended.
-- Project 7: the new 1-year renewal created when the old one closed.
(
    6, 'Tech Solutions - Support Agreement (Q1 2025)',
    'Initial 3-month post-launch support agreement. Expired - renewed as a separate project.',
    2, 6, 'completed', 'LKR', 45000.00, 'completed',
    'uploads/purchase-orders/po-support-techsolutions-q1.pdf',
    DATE_SUB(NOW(), INTERVAL 3 MONTH),
    DATE_SUB(CURDATE(), INTERVAL 3 MONTH), 1
),
(
    7, 'Tech Solutions - Support Agreement (Annual 2025)',
    '12-month support agreement created after the Q1 contract expired. Covers bug fixes, minor changes, and SLA response times.',
    2, 6, 'kickoff', 'LKR', 180000.00, 'active',
    'uploads/purchase-orders/po-support-techsolutions-annual.pdf',
    DATE_SUB(NOW(), INTERVAL 2 DAY),
    CURDATE(), 1
),
-- ── Professional Services - closed engagement + active new scope ──────────
-- Project 8: feature request (dark-mode UI) for the completed e-commerce site.
-- Demonstrates how professional services create a new project per engagement.
(
    8, 'ABC Corp - Dark Mode & Accessibility Upgrade',
    'Post-delivery professional services engagement: dark-mode theme, WCAG 2.1 AA compliance, and performance audit for the existing e-commerce platform.',
    1, 7, 'submitted', 'LKR', 95000.00, 'active',
    NULL, NULL,
    DATE_SUB(CURDATE(), INTERVAL 7 DAY), 1
),
-- ── Cancelled project - for testing the cancel/restore flow in the UI ─────
-- Project 9: mid-project cancellation due to client dropping the scope.
-- Appears in the "N cancelled" badge on the Project Delivery board.
(
    9, 'Startup Innovations - ERP Portal',
    'Custom ERP portal for Startup Innovations. Project cancelled mid-kickoff due to budget constraints.',
    4, 1, 'cancelled', 'LKR', 320000.00, 'cancelled',
    NULL, NULL,
    DATE_SUB(CURDATE(), INTERVAL 15 DAY), 1
);

-- -----------------------------------------------------------------------------
-- Proposals
--
-- P260101  Project 1  accepted  - full workflow done (PO received, invoice exists)
-- P260102  Project 2  accepted  - waiting for PO upload
-- P260103  Project 3  accepted  - project completed
-- P260104  Project 4  sent      - awaiting customer acceptance
-- P260105  Project 4  revision_requested - shows revision cycle in the same project
-- P260106  Standalone  draft    - unlinked standalone proposal for exploration
-- -----------------------------------------------------------------------------
INSERT INTO proposals
    (id, proposal_number, client_id, project_id, template_id, subject,
     total_amount, currency, valid_until, status, source, notes, created_by)
VALUES
(1, 'P260101', 1, 1, 1, 'E-Commerce Platform Development',
 500000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'template',
 'Full e-commerce proposal, accepted by client', 1),

(2, 'P260102', 2, 2, 1, 'Mobile Banking App Development',
 750000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'template',
 'Mobile app proposal, accepted, awaiting PO', 1),

(3, 'P260103', 3, 3, 1, 'Brand Identity Design Package',
 150000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'template',
 'Branding proposal, project completed', 1),

(4, 'P260104', 6, 4, 1, 'Retail Management System Development',
 400000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'template',
 'Initial proposal sent to client for review', 1),

(5, 'P260105', 6, 4, 1, 'Retail Management System Revised Scope',
 380000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'revision_requested', 'template',
 'Client requested scope adjustment, awaiting revised document', 1),

(6, 'P260106', 5, NULL, 1, 'Social Media Marketing Strategy',
  120000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'draft', 'template',
  'Draft proposal for upcoming marketing campaign', 1),

-- Support Agreement proposals
(7, 'P260107', 2, 6, 1, 'Q1 2025 Support Agreement - 3 Months',
  45000.00, 'LKR', DATE_SUB(CURDATE(), INTERVAL 3 MONTH), 'accepted', 'template',
  'Original 3-month support agreement. Expired and superseded by annual renewal.', 1),

(8, 'P260108', 2, 7, 1, 'Annual Support Agreement 2025 - 12 Months',
  180000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'accepted', 'template',
  'Annual renewal agreed after Q1 contract expiry. SLA: 48-hour response, monthly health checks.', 1),

-- Professional Services proposal
(9, 'P260109', 1, 8, 1, 'Dark Mode & Accessibility Upgrade - Professional Services',
  95000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'sent', 'template',
  'Post-delivery feature engagement: dark-mode theme, WCAG 2.1 AA, and performance audit.', 1);

-- Proposal Line Items
INSERT INTO proposal_line_items (proposal_id, description, quantity, unit_price, total_price) VALUES
-- P260101  E-Commerce
(1, 'E-Commerce Platform Development', 1, 350000.00, 350000.00),
(1, 'Payment Gateway Integration',     1,  80000.00,  80000.00),
(1, 'Hosting & Maintenance (1 year)',  1,  70000.00,  70000.00),
-- P260102  Mobile App
(2, 'iOS App Development',             1, 350000.00, 350000.00),
(2, 'Android App Development',         1, 300000.00, 300000.00),
(2, 'API Integration & Testing',       1, 100000.00, 100000.00),
-- P260103  Branding
(3, 'Logo Design & Brand Identity',    1,  70000.00,  70000.00),
(3, 'Brand Guidelines Document',       1,  50000.00,  50000.00),
(3, 'Marketing Collateral Set',        1,  30000.00,  30000.00),
-- P260104  Retail
(4, 'System Analysis & Architecture',  1,  80000.00,  80000.00),
(4, 'Backend Development',             1, 200000.00, 200000.00),
(4, 'Frontend & Reporting Module',     1, 100000.00, 100000.00),
(4, 'Testing & Deployment',            1,  20000.00,  20000.00),
-- P260105  Retail Revised
(5, 'System Analysis & Architecture',  1,  80000.00,  80000.00),
(5, 'Backend Development (revised)',   1, 200000.00, 200000.00),
(5, 'Frontend Development',            1, 100000.00, 100000.00),
-- P260106  Marketing
(6, 'Social Media Strategy',           1,  50000.00,  50000.00),
(6, 'Content Creation (3 months)',     3,  20000.00,  60000.00),
(6, 'Ad Campaign Management',          1,  10000.00,  10000.00),
-- P260107  Support Agreement Q1 (expired)
(7, 'Monthly Support Retainer',        3,  15000.00,  45000.00),
-- P260108  Annual Support Agreement
(8, 'Monthly Support Retainer',       12,  15000.00, 180000.00),
-- P260109  Professional Services - Dark Mode
(9, 'Dark Mode Theme Implementation',  1,  40000.00,  40000.00),
(9, 'WCAG 2.1 AA Accessibility Audit', 1,  25000.00,  25000.00),
(9, 'Performance Optimisation',        1,  30000.00,  30000.00);

-- Payment Stages
INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status) VALUES
-- P260101
(1, 'Kickoff Payment', 30.00, 150000.00, DATE_ADD(CURDATE(), INTERVAL  7 DAY), 'paid'),
(1, 'Development',     50.00, 250000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid'),
(1, 'Final Payment',   20.00, 100000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
-- P260102
(2, 'Advance Payment', 30.00, 225000.00, DATE_ADD(CURDATE(), INTERVAL  7 DAY), 'pending'),
(2, 'Development',     50.00, 375000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(2, 'Final Payment',   20.00, 150000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
-- P260103
(3, 'Advance Payment', 50.00,  75000.00, DATE_ADD(CURDATE(), INTERVAL  7 DAY), 'paid'),
(3, 'Final Payment',   50.00,  75000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid'),
-- P260104
(4, 'Kickoff Payment', 30.00, 120000.00, DATE_ADD(CURDATE(), INTERVAL  7 DAY), 'pending'),
(4, 'Development',     50.00, 200000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(4, 'Final Payment',   20.00,  80000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
-- P260107  Support Q1 (expired) - fully paid
(7, 'Month 1', 33.34,  15000.00, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), 'paid'),
(7, 'Month 2', 33.33,  15000.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'paid'),
(7, 'Month 3', 33.33,  15000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'paid'),
-- P260108  Annual Support - upfront + quarterly checks
(8, 'Upfront Payment',   50.00, 90000.00, DATE_ADD(CURDATE(), INTERVAL  7 DAY), 'pending'),
(8, 'Mid-Year Payment',  50.00, 90000.00, DATE_ADD(CURDATE(), INTERVAL 180 DAY), 'pending'),
-- P260109  Professional Services
(9, 'Kickoff Payment', 50.00, 47500.00, DATE_ADD(CURDATE(), INTERVAL  7 DAY), 'pending'),
(9, 'Final Payment',   50.00, 47500.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'pending');

-- -----------------------------------------------------------------------------
-- Service Agreements
--
-- Statuses use the updated ENUM:
--   signed             - customer has accepted and signed
--   sent               - document sent, awaiting customer response
--   revision_requested - customer asked for changes
-- -----------------------------------------------------------------------------
INSERT INTO service_agreements
    (agreement_number, project_id, template_id, subject, status, source, notes, created_by)
VALUES
('S260101', 1, 1, 'E-Commerce Website Development Agreement',
 'signed', 'template', 'Signed and executed, project kicked off', 1),

('S260102', 2, 1, 'Mobile Banking App Development Agreement',
 'signed', 'template', 'Signed, awaiting Purchase Order from client', 1),

('S260103', 3, 1, 'Brand Identity Design Agreement',
 'signed', 'template', 'Signed, project completed', 1),

('S260104', 4, 1, 'Retail Management System Development Agreement',
 'sent', 'template', 'Sent alongside proposal, awaiting client acceptance', 1);

-- -----------------------------------------------------------------------------
-- Invoices  (only for projects with PO - Projects 1 and 3)
--
-- payment_stage_id: links an invoice to a specific proposal milestone.
-- These seed invoices pre-date milestone linking so it is NULL here;
-- new invoices created via the UI will carry a payment_stage_id.
-- -----------------------------------------------------------------------------
INSERT INTO invoices
    (id, invoice_number, client_id, project_id, proposal_id, payment_stage_id, template_id,
     subject, total_amount, currency, tax_amount, discount_amount, final_amount,
     due_date, status, notes, created_by)
VALUES
(1, 'D260101', 1, 1, 1, NULL, 1,
 'E-Commerce Platform Kickoff Invoice',
 500000.00, 'LKR', 0.00, 0.00, 500000.00,
 DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent',
 'Kickoff invoice, PO on file', 1),

(2, 'D260102', 3, 3, 3, NULL, 1,
 'Brand Identity Design Full Project',
 150000.00, 'LKR', 0.00, 0.00, 150000.00,
 DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'paid',
 'Full project invoice, completed and paid', 1);

-- Invoice Line Items
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price) VALUES
-- D260101
(1, 'E-Commerce Platform Development', 1, 350000.00, 350000.00),
(1, 'Payment Gateway Integration',     1,  80000.00,  80000.00),
(1, 'Hosting & Maintenance (1 year)',  1,  70000.00,  70000.00),
-- D260102
(2, 'Logo Design & Brand Identity',    1,  70000.00,  70000.00),
(2, 'Brand Guidelines Document',       1,  50000.00,  50000.00),
(2, 'Marketing Collateral Set',        1,  30000.00,  30000.00);

-- -----------------------------------------------------------------------------
-- Payments  (for Projects 1 and 3 - completed workflow)
--
-- proof_path / proof_original_name: bank slip evidence uploaded via the UI.
-- NULL here as seed data does not ship with actual files.
-- -----------------------------------------------------------------------------
INSERT INTO payments
    (invoice_id, proposal_id, project_id, payment_type, amount, payment_date,
     payment_method, reference_number, description, recipient_name, recipient_type,
     proof_path, proof_original_name, created_by)
VALUES
-- Project 1 (E-Commerce)
(1, 1, 1, 'advance',           250000.00, DATE_SUB(CURDATE(), INTERVAL  5 DAY),
 'Bank Transfer', 'TXN2601001', 'E-commerce advance payment (50%)',   NULL,            'company',   NULL, NULL, 1),
(1, 1, 1, 'broker_commission',  25000.00, DATE_SUB(CURDATE(), INTERVAL  4 DAY),
 'Bank Transfer', 'TXN2601002', 'Broker commission, referral fee',    'John Broker',   'broker',    NULL, NULL, 1),
(1, 1, 1, 'developer_payment', 150000.00, DATE_SUB(CURDATE(), INTERVAL  3 DAY),
 'Bank Transfer', 'TXN2601003', 'Developer payment, frontend team',   'Dev Team Alpha','developer', NULL, NULL, 1),
-- Project 3 (Brand Identity)
(2, 3, 3, 'advance',            75000.00, DATE_SUB(CURDATE(), INTERVAL 50 DAY),
 'Bank Transfer', 'TXN2603001', 'Branding advance payment (50%)',     NULL,            'company',   NULL, NULL, 1),
(2, 3, 3, 'final',              75000.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY),
 'Bank Transfer', 'TXN2603002', 'Branding final payment (50%)',       NULL,            'company',   NULL, NULL, 1);

-- -----------------------------------------------------------------------------
-- Recurring Bills
-- -----------------------------------------------------------------------------
INSERT INTO recurring_bills
    (project_id, client_id, service_id, amount, frequency,
     start_date, end_date, next_billing_date, status, auto_generate, created_by)
VALUES
(1, 1, 1, 25000.00, 'monthly',
 DATE_SUB(CURDATE(), INTERVAL 1 MONTH), NULL,
 DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1),

(3, 3, 3, 15000.00, 'annually',
 DATE_SUB(CURDATE(), INTERVAL 1 YEAR), NULL,
 DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'active', TRUE, 1),

-- Annual support agreement - monthly billing cycle
(7, 2, 6, 15000.00, 'monthly',
 CURDATE(), DATE_ADD(CURDATE(), INTERVAL 12 MONTH),
 DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1);

-- -----------------------------------------------------------------------------
-- Design Documents  (standalone - sent after information gathering)
-- -----------------------------------------------------------------------------
INSERT INTO design_documents
    (document_number, project_id, subject, file_path, status, notes, created_by)
VALUES
('DD260101', 1, 'E-Commerce Website UI/UX Design Specifications',
 'uploads/design-documents/design-doc-ecommerce.docx', 'sent',
 'Initial UI/UX design sent to client for review', 1),

('DD260102', 3, 'Brand Identity Final Design Package',
 'uploads/design-documents/design-doc-branding.docx', 'accepted',
 'All design assets approved by client', 1);

-- =============================================================================
-- Summary
-- =============================================================================
SELECT 'Seed data inserted successfully!' AS message;
SELECT COUNT(*) AS total_services           FROM services;
SELECT COUNT(*) AS total_users              FROM users;
SELECT COUNT(*) AS total_clients            FROM clients;
SELECT COUNT(*) AS total_client_contacts    FROM client_contacts;
SELECT status,  COUNT(*) AS count           FROM clients             GROUP BY status;
SELECT COUNT(*) AS total_projects           FROM projects;
SELECT phase,   COUNT(*) AS count           FROM projects            GROUP BY phase;
SELECT COUNT(*) AS total_proposals          FROM proposals;
SELECT status,  COUNT(*) AS count           FROM proposals           GROUP BY status;
SELECT COUNT(*) AS total_service_agreements FROM service_agreements;
SELECT status,  COUNT(*) AS count           FROM service_agreements  GROUP BY status;
SELECT COUNT(*) AS total_invoices           FROM invoices;
SELECT COUNT(*) AS total_payments           FROM payments;
SELECT COUNT(*) AS total_recurring_bills    FROM recurring_bills;
SELECT COUNT(*) AS total_design_docs        FROM design_documents;
