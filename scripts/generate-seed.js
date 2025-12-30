const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Default passwords (change these if needed)
const ADMIN_PASSWORD = "admin123";
const STAFF_PASSWORD = "admin123";

console.log("Generating seed.sql with proper password hashes...\n");

// Generate password hashes
const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const staffHash = bcrypt.hashSync(STAFF_PASSWORD, 10);

const seedContent = `-- Seed Data for Dekode IT Invoice & Proposal Management System
-- Run this after schema.sql
-- Generated with proper password hashes

USE dekodeit_docs;

-- Insert Admin User
-- Default password for admin@dekodeit.com: ${ADMIN_PASSWORD}
-- Default password for staff@dekodeit.com: ${STAFF_PASSWORD}
-- ⚠️ CHANGE THESE PASSWORDS IN PRODUCTION!
INSERT INTO users (email, password, name, role) VALUES
('admin@dekodeit.com', '${adminHash}', 'Admin User', 'admin'),
('staff@dekodeit.com', '${staffHash}', 'Staff User', 'staff')
ON DUPLICATE KEY UPDATE email=email;

-- Sample Customers
INSERT INTO customers (name, email, phone, company, address, vat_id, notes, created_by) VALUES
('John Smith', 'john.smith@example.com', '+94 77 123 4567', 'ABC Corporation', '123 Business Street, Colombo 05', 'TAX001234', 'Regular client, prefers email communication', 1),
('Sarah Johnson', 'sarah.j@techsolutions.lk', '+94 11 234 5678', 'Tech Solutions Lanka', '456 Tech Park, Kandy', 'TAX005678', 'Monthly support client', 1),
('Michael Chen', 'michael.chen@global.com', '+94 77 345 6789', 'Global Enterprises', '789 International Road, Galle', 'TAX009012', 'Large project client', 1),
('Emma Williams', 'emma.w@startup.io', '+94 11 456 7890', 'Startup Innovations', '321 Innovation Hub, Negombo', NULL, 'New startup, flexible payment terms', 1),
('David Brown', 'david.brown@digital.lk', '+94 77 567 8901', 'Digital Marketing Pro', '654 Digital Avenue, Jaffna', 'TAX012345', 'Social media marketing client', 1)
ON DUPLICATE KEY UPDATE name=name;

-- Sample Proposal Template
INSERT INTO proposal_templates (name, description, html_content, variables, created_by) VALUES
('Standard Proposal Template', 'Default proposal template for Dekode IT', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Proposal {{proposal_number}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { color: #dc2626; font-size: 24px; font-weight: bold; }
        .proposal-info { margin: 20px 0; }
        .section { margin: 30px 0; }
        .total { font-size: 18px; font-weight: bold; color: #dc2626; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f3f4f6; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">DEKODE IT</div>
        <h1>PROPOSAL</h1>
        <div class="proposal-info">
            <p><strong>Proposal Number:</strong> {{proposal_number}}</p>
            <p><strong>Date:</strong> {{date}}</p>
            <p><strong>Valid Until:</strong> {{proposal.valid_until}}</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Client Information</h2>
        <p><strong>Name:</strong> {{customer.name}}</p>
        <p><strong>Company:</strong> {{customer.company}}</p>
        <p><strong>Email:</strong> {{customer.email}}</p>
        <p><strong>Phone:</strong> {{customer.phone}}</p>
        <p><strong>Address:</strong> {{customer.address}}</p>
    </div>
    
    <div class="section">
        <h2>Proposal Details</h2>
        <p><strong>Subject:</strong> {{proposal.subject}}</p>
    </div>
    
    <div class="section">
        <h2>Pricing</h2>
        <p class="total">Total Amount: {{proposal.currency}} {{proposal.total_amount}}</p>
    </div>
    
    <div class="section">
        <p>Thank you for considering Dekode IT for your project. We look forward to working with you.</p>
        <p>Best regards,<br>Dekode IT Team</p>
    </div>
</body>
</html>',
'["proposal_number", "date", "customer.name", "customer.email", "customer.phone", "customer.company", "customer.address", "proposal.total_amount", "proposal.currency", "proposal.valid_until", "proposal.subject"]',
1)
ON DUPLICATE KEY UPDATE name=name;

-- Sample Invoice Template
INSERT INTO invoice_templates (name, description, html_content, variables, created_by) VALUES
('Standard Invoice Template', 'Default invoice template for Dekode IT',
'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice {{invoice_number}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { color: #dc2626; font-size: 24px; font-weight: bold; }
        .invoice-info { margin: 20px 0; }
        .section { margin: 30px 0; }
        .total { font-size: 18px; font-weight: bold; color: #dc2626; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f3f4f6; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">DEKODE IT</div>
        <h1>INVOICE</h1>
        <div class="invoice-info">
            <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
            <p><strong>Date:</strong> {{date}}</p>
            <p><strong>Due Date:</strong> {{invoice.due_date}}</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Bill To</h2>
        <p><strong>Name:</strong> {{customer.name}}</p>
        <p><strong>Company:</strong> {{customer.company}}</p>
        <p><strong>Email:</strong> {{customer.email}}</p>
        <p><strong>Phone:</strong> {{customer.phone}}</p>
        <p><strong>Address:</strong> {{customer.address}}</p>
        <p><strong>VAT ID:</strong> {{customer.vat_id}}</p>
    </div>
    
    <div class="section">
        <h2>Invoice Details</h2>
        <p><strong>Subject:</strong> {{invoice.subject}}</p>
    </div>
    
    <div class="section">
        <h2>Amount Summary</h2>
        <table>
            <tr>
                <td>Subtotal:</td>
                <td class="text-right">{{invoice.currency}} {{invoice.total_amount}}</td>
            </tr>
            <tr>
                <td>Tax:</td>
                <td class="text-right">{{invoice.currency}} {{invoice.tax_amount}}</td>
            </tr>
            <tr>
                <td>Discount:</td>
                <td class="text-right">{{invoice.currency}} {{invoice.discount_amount}}</td>
            </tr>
            <tr class="total">
                <td><strong>Total:</strong></td>
                <td class="text-right"><strong>{{invoice.currency}} {{invoice.final_amount}}</strong></td>
            </tr>
        </table>
    </div>
    
    <div class="section">
        <p>Thank you for your business!</p>
        <p>Best regards,<br>Dekode IT Team</p>
    </div>
</body>
</html>',
'["invoice_number", "date", "customer.name", "customer.email", "customer.phone", "customer.company", "customer.address", "customer.vat_id", "invoice.total_amount", "invoice.tax_amount", "invoice.discount_amount", "invoice.final_amount", "invoice.currency", "invoice.due_date", "invoice.subject"]',
1)
ON DUPLICATE KEY UPDATE name=name;

-- Sample Project
INSERT INTO projects (name, description, customer_id, service_id, phase, total_amount, status, start_date, created_by) VALUES
('E-Commerce Website Development', 'Full-stack e-commerce platform with payment integration', 1, 1, 'kickoff', 500000.00, 'active', CURDATE(), 1),
('Mobile App for Tech Solutions', 'iOS and Android mobile application', 2, 2, 'in progress', 750000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 1),
('Brand Identity Design', 'Complete branding package including logo and guidelines', 3, 3, 'completed', 150000.00, 'completed', DATE_SUB(CURDATE(), INTERVAL 60 DAY), 1)
ON DUPLICATE KEY UPDATE name=name;

-- Display summary
SELECT 'Seed data inserted successfully!' AS message;
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_customers FROM customers;
SELECT COUNT(*) AS total_templates FROM proposal_templates;
SELECT COUNT(*) AS total_invoice_templates FROM invoice_templates;
SELECT COUNT(*) AS total_projects FROM projects;
`;

// Write to seed.sql file
const seedPath = path.join(__dirname, "..", "database", "seed.sql");
fs.writeFileSync(seedPath, seedContent, "utf8");

console.log("✓ seed.sql generated successfully!");
console.log(`✓ File location: ${seedPath}`);
console.log("\nDefault credentials:");
console.log("  Admin: admin@dekodeit.com / admin123");
console.log("  Staff: staff@dekodeit.com / admin123");
console.log("\n⚠️  IMPORTANT: Change these passwords in production!");
console.log("\nTo use the seed file, run:");
console.log("  mysql -u root -p < database/seed.sql\n");
