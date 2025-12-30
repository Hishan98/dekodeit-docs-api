-- Seed Data for Dekode IT Invoice & Proposal Management System
-- Run this after schema.sql

USE dekodeit_docs;

-- Insert Admin User
-- Default password for both users: admin123
-- ⚠️ CHANGE THESE PASSWORDS IN PRODUCTION!
INSERT INTO users (email, password, name, role) VALUES
('admin@dekodeit.com', '$2b$10$jSX7ZFDDZdeS.kY2CbEUReF2xoy7o55..Tt4xRaHfa2Cl2VgU6om.', 'Admin User', 'admin'),
('staff@dekodeit.com', '$2b$10$8JkexIV9NAHFrOIZ5tPJH.bK2.fKIyUwPmW2WOT55IQA/OW7Rl9ii', 'Staff User', 'staff')
ON DUPLICATE KEY UPDATE email=email;

-- Sample Customers (20 customers)
INSERT INTO customers (name, email, phone, company, address, vat_id, notes, created_by) VALUES
('John Smith', 'john.smith@example.com', '+94 77 123 4567', 'ABC Corporation', '123 Business Street, Colombo 05', 'TAX001234', 'Regular client, prefers email communication', 1),
('Sarah Johnson', 'sarah.j@techsolutions.lk', '+94 11 234 5678', 'Tech Solutions Lanka', '456 Tech Park, Kandy', 'TAX005678', 'Monthly support client', 1),
('Michael Chen', 'michael.chen@global.com', '+94 77 345 6789', 'Global Enterprises', '789 International Road, Galle', 'TAX009012', 'Large project client', 1),
('Emma Williams', 'emma.w@startup.io', '+94 11 456 7890', 'Startup Innovations', '321 Innovation Hub, Negombo', NULL, 'New startup, flexible payment terms', 1),
('David Brown', 'david.brown@digital.lk', '+94 77 567 8901', 'Digital Marketing Pro', '654 Digital Avenue, Jaffna', 'TAX012345', 'Social media marketing client', 1),
('Lisa Anderson', 'lisa.anderson@retail.com', '+94 11 678 9012', 'Retail Plus Ltd', '789 Shopping Complex, Kurunegala', 'TAX015678', 'E-commerce platform client', 1),
('Robert Taylor', 'robert.t@finance.lk', '+94 77 789 0123', 'Finance Hub', '321 Financial District, Gampaha', 'TAX018901', 'Banking software project', 1),
('Maria Garcia', 'maria.g@healthcare.lk', '+94 11 890 1234', 'HealthCare Systems', '456 Medical Center, Anuradhapura', 'TAX021234', 'Hospital management system', 1),
('James Wilson', 'james.w@education.edu', '+94 77 901 2345', 'EduTech Solutions', '789 University Road, Peradeniya', 'TAX024567', 'Learning management system', 1),
('Patricia Martinez', 'patricia.m@realestate.lk', '+94 11 012 3456', 'Property Management Co', '123 Real Estate Avenue, Matara', 'TAX027890', 'Property listing platform', 1),
('William Lee', 'william.l@logistics.lk', '+94 77 123 4567', 'Logistics Express', '456 Transport Hub, Ratnapura', 'TAX031234', 'Fleet management system', 1),
('Jennifer White', 'jennifer.w@hospitality.lk', '+94 11 234 5678', 'Hotel Grand', '789 Tourist Street, Kandy', 'TAX034567', 'Hotel booking system', 1),
('Christopher Harris', 'chris.h@manufacturing.lk', '+94 77 345 6789', 'Manufacturing Plus', '321 Industrial Zone, Kurunegala', 'TAX037890', 'ERP system implementation', 1),
('Amanda Clark', 'amanda.c@fashion.lk', '+94 11 456 7890', 'Fashion Forward', '654 Fashion Street, Colombo 07', 'TAX041234', 'E-commerce fashion store', 1),
('Daniel Lewis', 'daniel.l@food.lk', '+94 77 567 8901', 'Food Delivery Express', '789 Food Court, Negombo', 'TAX044567', 'Food delivery app', 1),
('Michelle Walker', 'michelle.w@fitness.lk', '+94 11 678 9012', 'Fitness Center Pro', '321 Gym Street, Galle', 'TAX047890', 'Gym management system', 1),
('Matthew Hall', 'matthew.h@automotive.lk', '+94 77 789 0123', 'Auto Service Center', '456 Garage Road, Jaffna', 'TAX051234', 'Auto service booking system', 1),
('Ashley Young', 'ashley.y@beauty.lk', '+94 11 890 1234', 'Beauty Salon Pro', '789 Beauty Avenue, Kandy', 'TAX054567', 'Salon booking platform', 1),
('Joshua King', 'joshua.k@construction.lk', '+94 77 901 2345', 'Construction Masters', '123 Building Site, Colombo 10', 'TAX057890', 'Project management system', 1),
('Stephanie Wright', 'stephanie.w@consulting.lk', '+94 11 012 3456', 'Business Consulting Group', '456 Office Tower, Gampaha', 'TAX061234', 'Consulting management platform', 1)
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

-- Sample Projects (15 projects)
INSERT INTO projects (name, description, customer_id, service_id, phase, total_amount, status, start_date, created_by) VALUES
('E-Commerce Website Development', 'Full-stack e-commerce platform with payment integration', 1, 1, 'kickoff', 500000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 1),
('Mobile App for Tech Solutions', 'iOS and Android mobile application', 2, 2, 'in progress', 750000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 1),
('Brand Identity Design', 'Complete branding package including logo and guidelines', 3, 3, 'completed', 150000.00, 'completed', DATE_SUB(CURDATE(), INTERVAL 60 DAY), 1),
('Retail Management System', 'Inventory and sales management platform', 6, 1, 'in progress', 400000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 1),
('Banking Software Suite', 'Core banking system with transaction processing', 7, 1, 'kickoff', 1200000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 1),
('Hospital Management System', 'Patient records and appointment scheduling', 8, 1, 'in progress', 600000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 25 DAY), 1),
('Learning Management Platform', 'Online course delivery and student management', 9, 1, 'completed', 350000.00, 'completed', DATE_SUB(CURDATE(), INTERVAL 90 DAY), 1),
('Property Listing Platform', 'Real estate listing and search system', 10, 1, 'support', 280000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 120 DAY), 1),
('Fleet Management System', 'Vehicle tracking and logistics management', 11, 1, 'in progress', 450000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 15 DAY), 1),
('Hotel Booking System', 'Reservation and room management platform', 12, 1, 'completed', 320000.00, 'completed', DATE_SUB(CURDATE(), INTERVAL 70 DAY), 1),
('ERP Implementation', 'Enterprise resource planning system', 13, 1, 'kickoff', 800000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 8 DAY), 1),
('Fashion E-Commerce Store', 'Online fashion retail platform', 14, 1, 'in progress', 380000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 18 DAY), 1),
('Food Delivery Mobile App', 'Restaurant and delivery management app', 15, 2, 'completed', 420000.00, 'completed', DATE_SUB(CURDATE(), INTERVAL 85 DAY), 1),
('Gym Management System', 'Membership and class scheduling system', 16, 1, 'support', 220000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 100 DAY), 1),
('Auto Service Booking Platform', 'Vehicle service appointment system', 17, 1, 'in progress', 260000.00, 'active', DATE_SUB(CURDATE(), INTERVAL 12 DAY), 1)
ON DUPLICATE KEY UPDATE name=name;

-- Sample Proposals (20 proposals)
INSERT INTO proposals (proposal_number, customer_id, project_id, template_id, subject, total_amount, currency, valid_until, status, notes, created_by) VALUES
('P250101', 4, NULL, 1, 'Startup Website Development', 200000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Initial proposal for startup website', 1),
('P250102', 5, NULL, 1, 'Social Media Marketing Campaign', 120000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', '3-month marketing campaign', 1),
('P250103', 6, 4, 1, 'Retail Management System', 400000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Full system implementation', 1),
('P250104', 7, 5, 1, 'Banking Software Development', 1200000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'sent', 'Core banking system', 1),
('P250105', 8, 6, 1, 'Hospital Management System', 600000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Complete hospital solution', 1),
('P250106', 9, 7, 1, 'Learning Management Platform', 350000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Online education platform', 1),
('P250107', 10, 8, 1, 'Property Listing Platform', 280000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Real estate platform', 1),
('P250108', 11, 9, 1, 'Fleet Management System', 450000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Logistics management', 1),
('P250109', 12, 10, 1, 'Hotel Booking System', 320000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Reservation system', 1),
('P250110', 13, 11, 1, 'ERP System Implementation', 800000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'sent', 'Enterprise solution', 1),
('P250111', 14, 12, 1, 'Fashion E-Commerce Store', 380000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Online fashion retail', 1),
('P250112', 15, 13, 1, 'Food Delivery Mobile App', 420000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Mobile app development', 1),
('P250113', 16, 14, 1, 'Gym Management System', 220000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'Fitness center solution', 1),
('P250114', 17, 15, 1, 'Auto Service Booking Platform', 260000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Service booking system', 1),
('P250115', 18, NULL, 1, 'Beauty Salon Booking System', 180000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'draft', 'Salon management', 1),
('P250116', 19, NULL, 1, 'Construction Project Management', 550000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'sent', 'Construction management', 1),
('P250117', 20, NULL, 1, 'Consulting Management Platform', 300000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'draft', 'Business consulting system', 1),
('P250118', 1, 1, 1, 'E-Commerce Platform Enhancement', 250000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Additional features', 1),
('P250119', 2, 2, 1, 'Mobile App Updates', 150000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'accepted', 'App maintenance', 1),
('P250120', 3, NULL, 1, 'Brand Refresh Package', 95000.00, 'LKR', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'declined', 'Brand redesign', 1)
ON DUPLICATE KEY UPDATE proposal_number=proposal_number;

-- Sample Proposal Line Items
INSERT INTO proposal_line_items (proposal_id, description, quantity, unit_price, total_price) VALUES
(1, 'Website Design & Development', 1, 150000.00, 150000.00),
(1, 'Hosting Setup (1 year)', 1, 50000.00, 50000.00),
(2, 'Social Media Strategy', 1, 50000.00, 50000.00),
(2, 'Content Creation (3 months)', 3, 20000.00, 60000.00),
(2, 'Ad Campaign Management', 1, 10000.00, 10000.00),
(3, 'System Analysis & Design', 1, 80000.00, 80000.00),
(3, 'Backend Development', 1, 200000.00, 200000.00),
(3, 'Frontend Development', 1, 100000.00, 100000.00),
(3, 'Testing & Deployment', 1, 20000.00, 20000.00),
(4, 'Core Banking Module', 1, 500000.00, 500000.00),
(4, 'Transaction Processing', 1, 400000.00, 400000.00),
(4, 'Reporting System', 1, 300000.00, 300000.00),
(5, 'Patient Management Module', 1, 200000.00, 200000.00),
(5, 'Appointment Scheduling', 1, 150000.00, 150000.00),
(5, 'Billing System', 1, 150000.00, 150000.00),
(5, 'Reporting Dashboard', 1, 100000.00, 100000.00),
(6, 'Course Management', 1, 150000.00, 150000.00),
(6, 'Student Portal', 1, 100000.00, 100000.00),
(6, 'Assessment System', 1, 100000.00, 100000.00),
(7, 'Property Listing System', 1, 150000.00, 150000.00),
(7, 'Search & Filter', 1, 80000.00, 80000.00),
(7, 'Admin Dashboard', 1, 50000.00, 50000.00),
(8, 'Vehicle Tracking', 1, 200000.00, 200000.00),
(8, 'Route Optimization', 1, 150000.00, 150000.00),
(8, 'Driver Management', 1, 100000.00, 100000.00),
(9, 'Reservation System', 1, 150000.00, 150000.00),
(9, 'Room Management', 1, 100000.00, 100000.00),
(9, 'Payment Integration', 1, 70000.00, 70000.00),
(10, 'Inventory Management', 1, 300000.00, 300000.00),
(10, 'HR Management', 1, 250000.00, 250000.00),
(10, 'Financial Management', 1, 250000.00, 250000.00),
(11, 'Product Catalog', 1, 150000.00, 150000.00),
(11, 'Shopping Cart', 1, 100000.00, 100000.00),
(11, 'Payment Gateway', 1, 80000.00, 80000.00),
(11, 'Order Management', 1, 50000.00, 50000.00),
(12, 'Restaurant App', 1, 200000.00, 200000.00),
(12, 'Customer App', 1, 150000.00, 150000.00),
(12, 'Driver App', 1, 70000.00, 70000.00),
(13, 'Member Management', 1, 100000.00, 100000.00),
(13, 'Class Scheduling', 1, 80000.00, 80000.00),
(13, 'Payment Processing', 1, 40000.00, 40000.00),
(14, 'Service Booking', 1, 120000.00, 120000.00),
(14, 'Customer Portal', 1, 80000.00, 80000.00),
(14, 'Service History', 1, 60000.00, 60000.00),
(15, 'Appointment System', 1, 100000.00, 100000.00),
(15, 'Service Management', 1, 50000.00, 50000.00),
(15, 'Payment Integration', 1, 30000.00, 30000.00),
(16, 'Project Planning', 1, 200000.00, 200000.00),
(16, 'Resource Management', 1, 200000.00, 200000.00),
(16, 'Progress Tracking', 1, 150000.00, 150000.00),
(17, 'Client Management', 1, 120000.00, 120000.00),
(17, 'Project Tracking', 1, 100000.00, 100000.00),
(17, 'Reporting System', 1, 80000.00, 80000.00),
(18, 'Feature Enhancement', 1, 150000.00, 150000.00),
(18, 'Performance Optimization', 1, 70000.00, 70000.00),
(18, 'Security Updates', 1, 30000.00, 30000.00),
(19, 'Bug Fixes', 1, 50000.00, 50000.00),
(19, 'New Features', 1, 70000.00, 70000.00),
(19, 'UI Updates', 1, 30000.00, 30000.00),
(20, 'Logo Design', 1, 40000.00, 40000.00),
(20, 'Brand Guidelines', 1, 35000.00, 35000.00),
(20, 'Marketing Materials', 1, 20000.00, 20000.00);

-- Sample Payment Stages for Proposals
INSERT INTO payment_stages (proposal_id, stage_name, percentage, amount, due_date, status) VALUES
(1, 'Kickoff Payment', 30.00, 60000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'pending'),
(1, 'Milestone 1', 40.00, 80000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'pending'),
(1, 'Final Payment', 30.00, 60000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(2, 'Advance Payment', 30.00, 36000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(2, 'Monthly Payment 1', 35.00, 42000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid'),
(2, 'Monthly Payment 2', 35.00, 42000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(3, 'Kickoff Payment', 30.00, 120000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(3, 'Development Phase', 50.00, 200000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'pending'),
(3, 'Final Payment', 20.00, 80000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(4, 'Advance Payment', 25.00, 300000.00, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'pending'),
(4, 'Phase 1 Completion', 35.00, 420000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(4, 'Phase 2 Completion', 25.00, 300000.00, DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'pending'),
(4, 'Final Payment', 15.00, 180000.00, DATE_ADD(CURDATE(), INTERVAL 180 DAY), 'pending'),
(5, 'Kickoff Payment', 30.00, 180000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(5, 'Development Phase', 50.00, 300000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(5, 'Final Payment', 20.00, 120000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(6, 'Advance Payment', 30.00, 105000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(6, 'Development Phase', 50.00, 175000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid'),
(6, 'Final Payment', 20.00, 70000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'paid'),
(7, 'Kickoff Payment', 30.00, 84000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(7, 'Development Phase', 50.00, 140000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid'),
(7, 'Final Payment', 20.00, 56000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'paid'),
(8, 'Advance Payment', 30.00, 135000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(8, 'Development Phase', 50.00, 225000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(8, 'Final Payment', 20.00, 90000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(9, 'Kickoff Payment', 30.00, 96000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(9, 'Development Phase', 50.00, 160000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid'),
(9, 'Final Payment', 20.00, 64000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'paid'),
(10, 'Advance Payment', 25.00, 200000.00, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'pending'),
(10, 'Phase 1', 35.00, 280000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(10, 'Phase 2', 25.00, 200000.00, DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'pending'),
(10, 'Final Payment', 15.00, 120000.00, DATE_ADD(CURDATE(), INTERVAL 180 DAY), 'pending'),
(11, 'Kickoff Payment', 30.00, 114000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(11, 'Development Phase', 50.00, 190000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(11, 'Final Payment', 20.00, 76000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(12, 'Advance Payment', 30.00, 126000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(12, 'Development Phase', 50.00, 210000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'paid'),
(12, 'Final Payment', 20.00, 84000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'paid'),
(13, 'Kickoff Payment', 30.00, 66000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(13, 'Development Phase', 50.00, 110000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid'),
(13, 'Final Payment', 20.00, 44000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'paid'),
(14, 'Advance Payment', 30.00, 78000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(14, 'Development Phase', 50.00, 130000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(14, 'Final Payment', 20.00, 52000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(15, 'Kickoff Payment', 30.00, 54000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'pending'),
(15, 'Development Phase', 50.00, 90000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'pending'),
(15, 'Final Payment', 20.00, 36000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(16, 'Advance Payment', 30.00, 165000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'pending'),
(16, 'Development Phase', 50.00, 275000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(16, 'Final Payment', 20.00, 110000.00, DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'pending'),
(17, 'Kickoff Payment', 30.00, 90000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'pending'),
(17, 'Development Phase', 50.00, 150000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(17, 'Final Payment', 20.00, 60000.00, DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'pending'),
(18, 'Advance Payment', 30.00, 75000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(18, 'Development Phase', 50.00, 125000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'pending'),
(18, 'Final Payment', 20.00, 50000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'pending'),
(19, 'Kickoff Payment', 30.00, 45000.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'paid'),
(19, 'Development Phase', 50.00, 75000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid'),
(19, 'Final Payment', 20.00, 30000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid');

-- Sample Invoices (25 invoices)
INSERT INTO invoices (invoice_number, customer_id, project_id, proposal_id, template_id, subject, total_amount, currency, tax_amount, discount_amount, final_amount, due_date, status, notes, created_by) VALUES
('D250101', 1, 1, NULL, 1, 'E-Commerce Website - Initial Payment', 500000.00, 'LKR', 50000.00, 0.00, 550000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Kickoff payment for e-commerce project', 1),
('D250102', 2, 2, 19, 1, 'Mobile App Maintenance', 150000.00, 'LKR', 15000.00, 5000.00, 160000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Monthly maintenance invoice', 1),
('D250103', 3, 3, NULL, 1, 'Brand Identity Design Package', 150000.00, 'LKR', 15000.00, 0.00, 165000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Complete branding solution', 1),
('D250104', 5, NULL, 2, 1, 'Social Media Marketing - Month 1', 40000.00, 'LKR', 4000.00, 0.00, 44000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'First month marketing services', 1),
('D250105', 5, NULL, 2, 1, 'Social Media Marketing - Month 2', 40000.00, 'LKR', 4000.00, 0.00, 44000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Second month marketing services', 1),
('D250106', 6, 4, 3, 1, 'Retail Management System - Kickoff', 120000.00, 'LKR', 12000.00, 0.00, 132000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Initial payment for retail system', 1),
('D250107', 6, 4, 3, 1, 'Retail Management System - Development', 200000.00, 'LKR', 20000.00, 0.00, 220000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'sent', 'Development phase payment', 1),
('D250108', 7, 5, 4, 1, 'Banking Software - Advance Payment', 300000.00, 'LKR', 30000.00, 0.00, 330000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Advance payment for banking system', 1),
('D250109', 8, 6, 5, 1, 'Hospital Management - Kickoff', 180000.00, 'LKR', 18000.00, 0.00, 198000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Initial payment for hospital system', 1),
('D250110', 8, 6, 5, 1, 'Hospital Management - Development', 300000.00, 'LKR', 30000.00, 0.00, 330000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'sent', 'Development phase payment', 1),
('D250111', 9, 7, 6, 1, 'Learning Platform - Final Payment', 70000.00, 'LKR', 7000.00, 0.00, 77000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Final payment for completed project', 1),
('D250112', 10, 8, 7, 1, 'Property Platform - Kickoff', 84000.00, 'LKR', 8400.00, 0.00, 92400.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Initial payment', 1),
('D250113', 10, 8, 7, 1, 'Property Platform - Development', 140000.00, 'LKR', 14000.00, 0.00, 154000.00, DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'paid', 'Development payment', 1),
('D250114', 10, 8, 7, 1, 'Property Platform - Final', 56000.00, 'LKR', 5600.00, 0.00, 61600.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'paid', 'Final payment', 1),
('D250115', 11, 9, 8, 1, 'Fleet Management - Kickoff', 135000.00, 'LKR', 13500.00, 0.00, 148500.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Initial payment', 1),
('D250116', 11, 9, 8, 1, 'Fleet Management - Development', 225000.00, 'LKR', 22500.00, 0.00, 247500.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'sent', 'Development phase', 1),
('D250117', 12, 10, 9, 1, 'Hotel Booking - Complete Payment', 320000.00, 'LKR', 32000.00, 10000.00, 342000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Full payment for completed project', 1),
('D250118', 13, 11, 10, 1, 'ERP System - Advance', 200000.00, 'LKR', 20000.00, 0.00, 220000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Advance payment', 1),
('D250119', 14, 12, 11, 1, 'Fashion Store - Kickoff', 114000.00, 'LKR', 11400.00, 0.00, 125400.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Initial payment', 1),
('D250120', 14, 12, 11, 1, 'Fashion Store - Development', 190000.00, 'LKR', 19000.00, 0.00, 209000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'sent', 'Development phase', 1),
('D250121', 15, 13, 12, 1, 'Food Delivery App - Complete', 420000.00, 'LKR', 42000.00, 20000.00, 442000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Full payment for completed app', 1),
('D250122', 16, 14, 13, 1, 'Gym Management - Complete', 220000.00, 'LKR', 22000.00, 0.00, 242000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Full payment', 1),
('D250123', 17, 15, 14, 1, 'Auto Service - Kickoff', 78000.00, 'LKR', 7800.00, 0.00, 85800.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'paid', 'Initial payment', 1),
('D250124', 17, 15, 14, 1, 'Auto Service - Development', 130000.00, 'LKR', 13000.00, 0.00, 143000.00, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'sent', 'Development payment', 1),
('D250125', 1, 1, 18, 1, 'E-Commerce Enhancement', 250000.00, 'LKR', 25000.00, 5000.00, 270000.00, DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'sent', 'Additional features invoice', 1)
ON DUPLICATE KEY UPDATE invoice_number=invoice_number;

-- Sample Invoice Line Items
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price) VALUES
(1, 'E-Commerce Platform Development', 1, 400000.00, 400000.00),
(1, 'Payment Gateway Integration', 1, 50000.00, 50000.00),
(1, 'Hosting & Maintenance (1 year)', 1, 50000.00, 50000.00),
(2, 'Bug Fixes & Updates', 1, 80000.00, 80000.00),
(2, 'New Features Implementation', 1, 50000.00, 50000.00),
(2, 'Performance Optimization', 1, 20000.00, 20000.00),
(3, 'Logo Design', 1, 60000.00, 60000.00),
(3, 'Brand Guidelines', 1, 50000.00, 50000.00),
(3, 'Marketing Materials', 1, 40000.00, 40000.00),
(4, 'Social Media Strategy', 1, 15000.00, 15000.00),
(4, 'Content Creation', 1, 15000.00, 15000.00),
(4, 'Ad Campaign Management', 1, 10000.00, 10000.00),
(5, 'Social Media Strategy', 1, 15000.00, 15000.00),
(5, 'Content Creation', 1, 15000.00, 15000.00),
(5, 'Ad Campaign Management', 1, 10000.00, 10000.00),
(6, 'System Analysis & Design', 1, 80000.00, 80000.00),
(6, 'Backend Development Setup', 1, 40000.00, 40000.00),
(7, 'Backend Development', 1, 120000.00, 120000.00),
(7, 'Frontend Development', 1, 80000.00, 80000.00),
(8, 'Core Banking Module Development', 1, 200000.00, 200000.00),
(8, 'Transaction Processing System', 1, 100000.00, 100000.00),
(9, 'Patient Management Module', 1, 100000.00, 100000.00),
(9, 'Appointment Scheduling System', 1, 80000.00, 80000.00),
(10, 'Billing System Development', 1, 150000.00, 150000.00),
(10, 'Reporting Dashboard', 1, 150000.00, 150000.00),
(11, 'Final Testing & Deployment', 1, 50000.00, 50000.00),
(11, 'Documentation', 1, 20000.00, 20000.00),
(12, 'Property Listing System', 1, 60000.00, 60000.00),
(12, 'Search & Filter Development', 1, 24000.00, 24000.00),
(13, 'Admin Dashboard Development', 1, 80000.00, 80000.00),
(13, 'User Management System', 1, 60000.00, 60000.00),
(14, 'Final Testing & Deployment', 1, 35000.00, 35000.00),
(14, 'Documentation & Training', 1, 21000.00, 21000.00),
(15, 'Vehicle Tracking System', 1, 90000.00, 90000.00),
(15, 'GPS Integration', 1, 45000.00, 45000.00),
(16, 'Route Optimization Algorithm', 1, 120000.00, 120000.00),
(16, 'Driver Management Module', 1, 105000.00, 105000.00),
(17, 'Reservation System', 1, 150000.00, 150000.00),
(17, 'Room Management', 1, 100000.00, 100000.00),
(17, 'Payment Integration', 1, 70000.00, 70000.00),
(18, 'ERP System Analysis', 1, 100000.00, 100000.00),
(18, 'Initial Setup & Configuration', 1, 100000.00, 100000.00),
(19, 'Product Catalog Development', 1, 80000.00, 80000.00),
(19, 'Shopping Cart Implementation', 1, 34000.00, 34000.00),
(20, 'Payment Gateway Integration', 1, 50000.00, 50000.00),
(20, 'Order Management System', 1, 110000.00, 110000.00),
(21, 'Restaurant App Development', 1, 180000.00, 180000.00),
(21, 'Customer App Development', 1, 150000.00, 150000.00),
(21, 'Driver App Development', 1, 90000.00, 90000.00),
(22, 'Member Management System', 1, 100000.00, 100000.00),
(22, 'Class Scheduling Module', 1, 80000.00, 80000.00),
(22, 'Payment Processing', 1, 40000.00, 40000.00),
(23, 'Service Booking System', 1, 60000.00, 60000.00),
(23, 'Customer Portal', 1, 18000.00, 18000.00),
(24, 'Service History Module', 1, 65000.00, 65000.00),
(24, 'Notification System', 1, 65000.00, 65000.00),
(25, 'Feature Enhancement', 1, 150000.00, 150000.00),
(25, 'Performance Optimization', 1, 70000.00, 70000.00),
(25, 'Security Updates', 1, 30000.00, 30000.00);

-- Sample Payments (30 payments)
INSERT INTO payments (invoice_id, proposal_id, project_id, payment_type, amount, payment_date, payment_method, reference_number, description, recipient_name, recipient_type, created_by) VALUES
(1, NULL, 1, 'advance', 165000.00, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Bank Transfer', 'TXN001234', 'Kickoff payment for e-commerce project', NULL, 'company', 1),
(1, NULL, 1, 'advance', 165000.00, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Bank Transfer', 'TXN001235', 'Additional advance payment', NULL, 'company', 1),
(1, NULL, 1, 'final', 220000.00, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Bank Transfer', 'TXN001236', 'Final payment', NULL, 'company', 1),
(2, 19, 2, 'advance', 48000.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Bank Transfer', 'TXN001237', 'App maintenance payment', NULL, 'company', 1),
(2, 19, 2, 'final', 112000.00, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'Bank Transfer', 'TXN001238', 'Final maintenance payment', NULL, 'company', 1),
(3, NULL, 3, 'advance', 49500.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Bank Transfer', 'TXN001239', 'Brand design advance', NULL, 'company', 1),
(3, NULL, 3, 'final', 115500.00, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'Bank Transfer', 'TXN001240', 'Final branding payment', NULL, 'company', 1),
(4, 2, NULL, 'advance', 13200.00, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Bank Transfer', 'TXN001241', 'Marketing month 1', NULL, 'company', 1),
(4, 2, NULL, 'advance', 13200.00, DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'Bank Transfer', 'TXN001242', 'Additional payment', NULL, 'company', 1),
(4, 2, NULL, 'final', 17600.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Bank Transfer', 'TXN001243', 'Final month 1 payment', NULL, 'company', 1),
(5, 2, NULL, 'advance', 13200.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Bank Transfer', 'TXN001244', 'Marketing month 2', NULL, 'company', 1),
(5, 2, NULL, 'final', 30800.00, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'Bank Transfer', 'TXN001245', 'Final month 2 payment', NULL, 'company', 1),
(6, 3, 4, 'advance', 39600.00, DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Bank Transfer', 'TXN001246', 'Retail system kickoff', NULL, 'company', 1),
(6, 3, 4, 'advance', 39600.00, DATE_SUB(CURDATE(), INTERVAL 23 DAY), 'Bank Transfer', 'TXN001247', 'Additional advance', NULL, 'company', 1),
(6, 3, 4, 'final', 52800.00, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Bank Transfer', 'TXN001248', 'Final kickoff payment', NULL, 'company', 1),
(9, 5, 6, 'advance', 59400.00, DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'Bank Transfer', 'TXN001249', 'Hospital system kickoff', NULL, 'company', 1),
(9, 5, 6, 'advance', 59400.00, DATE_SUB(CURDATE(), INTERVAL 16 DAY), 'Bank Transfer', 'TXN001250', 'Additional payment', NULL, 'company', 1),
(9, 5, 6, 'final', 79200.00, DATE_SUB(CURDATE(), INTERVAL 14 DAY), 'Bank Transfer', 'TXN001251', 'Final kickoff payment', NULL, 'company', 1),
(11, 6, 7, 'final', 23100.00, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Bank Transfer', 'TXN001252', 'Learning platform final', NULL, 'company', 1),
(11, 6, 7, 'final', 23100.00, DATE_SUB(CURDATE(), INTERVAL 28 DAY), 'Bank Transfer', 'TXN001253', 'Additional final payment', NULL, 'company', 1),
(11, 6, 7, 'final', 30800.00, DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Bank Transfer', 'TXN001254', 'Complete final payment', NULL, 'company', 1),
(12, 7, 8, 'advance', 27720.00, DATE_SUB(CURDATE(), INTERVAL 22 DAY), 'Bank Transfer', 'TXN001255', 'Property platform kickoff', NULL, 'company', 1),
(12, 7, 8, 'advance', 27720.00, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Bank Transfer', 'TXN001256', 'Additional advance', NULL, 'company', 1),
(12, 7, 8, 'final', 36960.00, DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'Bank Transfer', 'TXN001257', 'Final kickoff payment', NULL, 'company', 1),
(13, 7, 8, 'advance', 46200.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Bank Transfer', 'TXN001258', 'Development phase payment', NULL, 'company', 1),
(13, 7, 8, 'advance', 46200.00, DATE_SUB(CURDATE(), INTERVAL 13 DAY), 'Bank Transfer', 'TXN001259', 'Additional development payment', NULL, 'company', 1),
(13, 7, 8, 'final', 61600.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Bank Transfer', 'TXN001260', 'Final development payment', NULL, 'company', 1),
(14, 7, 8, 'final', 18480.00, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'Bank Transfer', 'TXN001261', 'Property platform final payment', NULL, 'company', 1),
(14, 7, 8, 'final', 18480.00, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'Bank Transfer', 'TXN001262', 'Additional final payment', NULL, 'company', 1),
(14, 7, 8, 'final', 24640.00, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Bank Transfer', 'TXN001263', 'Complete final payment', NULL, 'company', 1),
(15, 8, 9, 'advance', 44550.00, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'Bank Transfer', 'TXN001264', 'Fleet management kickoff', NULL, 'company', 1),
(15, 8, 9, 'advance', 44550.00, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Bank Transfer', 'TXN001265', 'Additional advance', NULL, 'company', 1),
(15, 8, 9, 'final', 59400.00, DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'Bank Transfer', 'TXN001266', 'Final kickoff payment', NULL, 'company', 1),
(17, 9, 10, 'advance', 102600.00, DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'Bank Transfer', 'TXN001267', 'Hotel booking advance', NULL, 'company', 1),
(17, 9, 10, 'advance', 102600.00, DATE_SUB(CURDATE(), INTERVAL 33 DAY), 'Bank Transfer', 'TXN001268', 'Additional advance', NULL, 'company', 1),
(17, 9, 10, 'final', 136800.00, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Bank Transfer', 'TXN001269', 'Final hotel booking payment', NULL, 'company', 1),
(19, 11, 12, 'advance', 37620.00, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Bank Transfer', 'TXN001270', 'Fashion store kickoff', NULL, 'company', 1),
(19, 11, 12, 'advance', 37620.00, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Bank Transfer', 'TXN001271', 'Additional advance', NULL, 'company', 1),
(19, 11, 12, 'final', 50160.00, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Bank Transfer', 'TXN001272', 'Final kickoff payment', NULL, 'company', 1),
(21, 12, 13, 'advance', 132600.00, DATE_SUB(CURDATE(), INTERVAL 40 DAY), 'Bank Transfer', 'TXN001273', 'Food delivery app advance', NULL, 'company', 1),
(21, 12, 13, 'advance', 132600.00, DATE_SUB(CURDATE(), INTERVAL 38 DAY), 'Bank Transfer', 'TXN001274', 'Additional advance', NULL, 'company', 1),
(21, 12, 13, 'final', 176800.00, DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'Bank Transfer', 'TXN001275', 'Final app payment', NULL, 'company', 1),
(22, 13, 14, 'advance', 72600.00, DATE_SUB(CURDATE(), INTERVAL 50 DAY), 'Bank Transfer', 'TXN001276', 'Gym management advance', NULL, 'company', 1),
(22, 13, 14, 'advance', 72600.00, DATE_SUB(CURDATE(), INTERVAL 48 DAY), 'Bank Transfer', 'TXN001277', 'Additional advance', NULL, 'company', 1),
(22, 13, 14, 'final', 96800.00, DATE_SUB(CURDATE(), INTERVAL 45 DAY), 'Bank Transfer', 'TXN001278', 'Final gym payment', NULL, 'company', 1),
(23, 14, 15, 'advance', 25740.00, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'Bank Transfer', 'TXN001279', 'Auto service kickoff', NULL, 'company', 1),
(23, 14, 15, 'advance', 25740.00, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Bank Transfer', 'TXN001280', 'Additional advance', NULL, 'company', 1),
(23, 14, 15, 'final', 34320.00, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Bank Transfer', 'TXN001281', 'Final kickoff payment', NULL, 'company', 1),
(1, NULL, 1, 'broker_commission', 27500.00, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Bank Transfer', 'TXN001282', 'Broker commission for e-commerce project', 'John Broker', 'broker', 1),
(3, NULL, 3, 'broker_commission', 8250.00, DATE_SUB(CURDATE(), INTERVAL 13 DAY), 'Bank Transfer', 'TXN001283', 'Broker commission for branding', 'Sarah Broker', 'broker', 1),
(6, 3, 4, 'broker_commission', 6600.00, DATE_SUB(CURDATE(), INTERVAL 21 DAY), 'Bank Transfer', 'TXN001284', 'Broker commission for retail system', 'Mike Broker', 'broker', 1),
(9, 5, 6, 'broker_commission', 9900.00, DATE_SUB(CURDATE(), INTERVAL 17 DAY), 'Bank Transfer', 'TXN001285', 'Broker commission for hospital system', 'Lisa Broker', 'broker', 1),
(17, 9, 10, 'broker_commission', 17100.00, DATE_SUB(CURDATE(), INTERVAL 32 DAY), 'Bank Transfer', 'TXN001286', 'Broker commission for hotel system', 'David Broker', 'broker', 1),
(1, NULL, 1, 'developer_payment', 200000.00, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Bank Transfer', 'TXN001287', 'Developer payment for e-commerce', 'Dev Team Alpha', 'developer', 1),
(6, 3, 4, 'developer_payment', 80000.00, DATE_SUB(CURDATE(), INTERVAL 19 DAY), 'Bank Transfer', 'TXN001288', 'Developer payment for retail system', 'Dev Team Beta', 'developer', 1),
(9, 5, 6, 'developer_payment', 120000.00, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Bank Transfer', 'TXN001289', 'Developer payment for hospital system', 'Dev Team Gamma', 'developer', 1);

-- Sample Recurring Bills (8 recurring bills)
INSERT INTO recurring_bills (project_id, customer_id, service_id, amount, frequency, start_date, end_date, next_billing_date, status, auto_generate, created_by) VALUES
(1, 1, 1, 50000.00, 'monthly', DATE_SUB(CURDATE(), INTERVAL 3 MONTH), NULL, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1),
(4, 6, 1, 30000.00, 'monthly', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), NULL, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1),
(8, 10, 1, 25000.00, 'monthly', DATE_SUB(CURDATE(), INTERVAL 4 MONTH), NULL, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1),
(10, 12, 1, 35000.00, 'monthly', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 10 MONTH), DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1),
(14, 16, 1, 20000.00, 'monthly', DATE_SUB(CURDATE(), INTERVAL 3 MONTH), NULL, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'active', TRUE, 1),
(7, 9, 1, 40000.00, 'annually', DATE_SUB(CURDATE(), INTERVAL 1 YEAR), NULL, DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 'active', TRUE, 1),
(11, 13, 1, 60000.00, 'annually', DATE_SUB(CURDATE(), INTERVAL 6 MONTH), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 'active', TRUE, 1),
(12, 14, 1, 45000.00, 'monthly', DATE_SUB(CURDATE(), INTERVAL 1 MONTH), NULL, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'paused', TRUE, 1)
ON DUPLICATE KEY UPDATE project_id=project_id;

-- Sample Design Document Templates (3 templates)
INSERT INTO design_document_templates (name, description, file_path, created_by) VALUES
('Standard Design Document Template', 'Default template for design documents', 'uploads/templates/dd-template-standard.docx', 1),
('Detailed Design Document Template', 'Comprehensive design document template with sections', 'uploads/templates/dd-template-detailed.docx', 1),
('Simple Design Document Template', 'Simplified design document template', 'uploads/templates/dd-template-simple.docx', 1)
ON DUPLICATE KEY UPDATE name=name;

-- Sample Design Documents (10 design documents)
INSERT INTO design_documents (document_number, project_id, subject, file_path, status, notes, created_by) VALUES
('DD250101', 1, 'E-Commerce Website Design Document', 'uploads/design-documents/design-doc-1.docx', 'sent', 'Initial design document for e-commerce platform', 1),
('DD250102', 2, 'Mobile App UI/UX Design', 'uploads/design-documents/design-doc-2.docx', 'accepted', 'Mobile app design specifications', 1),
('DD250103', 4, 'Retail System Design Document', 'uploads/design-documents/design-doc-3.docx', 'draft', 'Retail management system design', 1),
('DD250104', 5, 'Banking Software Design', 'uploads/design-documents/design-doc-4.docx', 'sent', 'Core banking system design document', 1),
('DD250105', 6, 'Hospital Management Design', 'uploads/design-documents/design-doc-5.docx', 'accepted', 'Hospital system design specifications', 1),
('DD250106', 7, 'Learning Platform Design', 'uploads/design-documents/design-doc-6.docx', 'accepted', 'Education platform design document', 1),
('DD250107', 8, 'Property Platform Design', 'uploads/design-documents/design-doc-7.docx', 'sent', 'Real estate platform design', 1),
('DD250108', 9, 'Fleet Management Design', 'uploads/design-documents/design-doc-8.docx', 'draft', 'Logistics system design document', 1),
('DD250109', 12, 'Fashion Store Design', 'uploads/design-documents/design-doc-9.docx', 'sent', 'E-commerce fashion store design', 1),
('DD250110', 13, 'Food Delivery App Design', 'uploads/design-documents/design-doc-10.docx', 'accepted', 'Mobile app design document', 1)
ON DUPLICATE KEY UPDATE document_number=document_number;

-- Sample Service Agreement Templates (2 templates)
INSERT INTO service_agreement_templates (name, description, html_content, variables, created_by) VALUES
('Standard Service Agreement', 'Default service agreement template',
'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Service Agreement {{agreement_number}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { color: #dc2626; font-size: 24px; font-weight: bold; }
        .agreement-info { margin: 20px 0; }
        .section { margin: 30px 0; }
        .signature-section { margin-top: 50px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">DEKODE IT</div>
        <h1>SERVICE AGREEMENT</h1>
        <div class="agreement-info">
            <p><strong>Agreement Number:</strong> {{agreement_number}}</p>
            <p><strong>Date:</strong> {{date}}</p>
            <p><strong>Subject:</strong> {{agreement.subject}}</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Parties</h2>
        <p><strong>Service Provider:</strong> Dekode IT</p>
        <p><strong>Client:</strong> {{customer.name}}</p>
        <p><strong>Company:</strong> {{customer.company}}</p>
        <p><strong>Email:</strong> {{customer.email}}</p>
        <p><strong>Phone:</strong> {{customer.phone}}</p>
        <p><strong>Address:</strong> {{customer.address}}</p>
    </div>
    
    <div class="section">
        <h2>Project Details</h2>
        <p><strong>Project Name:</strong> {{project.name}}</p>
    </div>
    
    <div class="section">
        <h2>Terms and Conditions</h2>
        <p>This service agreement outlines the terms and conditions for the provision of services by Dekode IT to the client.</p>
        <p>All services will be provided in accordance with industry best practices and standards.</p>
    </div>
    
    <div class="signature-section">
        <p>By signing below, both parties agree to the terms and conditions outlined in this agreement.</p>
        <br><br>
        <p>_________________________<br>Dekode IT</p>
        <br><br>
        <p>_________________________<br>{{customer.name}}</p>
    </div>
</body>
</html>',
'["agreement_number", "date", "customer.name", "customer.email", "customer.phone", "customer.company", "customer.address", "project.name", "agreement.subject"]',
1),
('Detailed Service Agreement', 'Comprehensive service agreement template with detailed terms',
'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Service Agreement {{agreement_number}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { color: #dc2626; font-size: 24px; font-weight: bold; }
        .agreement-info { margin: 20px 0; }
        .section { margin: 30px 0; }
        .signature-section { margin-top: 50px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">DEKODE IT</div>
        <h1>DETAILED SERVICE AGREEMENT</h1>
        <div class="agreement-info">
            <p><strong>Agreement Number:</strong> {{agreement_number}}</p>
            <p><strong>Date:</strong> {{date}}</p>
            <p><strong>Subject:</strong> {{agreement.subject}}</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Parties</h2>
        <p><strong>Service Provider:</strong> Dekode IT</p>
        <p><strong>Client:</strong> {{customer.name}}</p>
        <p><strong>Company:</strong> {{customer.company}}</p>
        <p><strong>Email:</strong> {{customer.email}}</p>
        <p><strong>Phone:</strong> {{customer.phone}}</p>
        <p><strong>Address:</strong> {{customer.address}}</p>
    </div>
    
    <div class="section">
        <h2>Project Details</h2>
        <p><strong>Project Name:</strong> {{project.name}}</p>
    </div>
    
    <div class="section">
        <h2>Scope of Services</h2>
        <p>The services to be provided include but are not limited to:</p>
        <ul>
            <li>Development and implementation of the agreed project</li>
            <li>Testing and quality assurance</li>
            <li>Documentation and training</li>
            <li>Support and maintenance as agreed</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Terms and Conditions</h2>
        <p>This service agreement outlines the terms and conditions for the provision of services by Dekode IT to the client.</p>
        <p>All services will be provided in accordance with industry best practices and standards.</p>
        <p>Payment terms, deliverables, and timelines will be as specified in the project proposal.</p>
    </div>
    
    <div class="signature-section">
        <p>By signing below, both parties agree to the terms and conditions outlined in this agreement.</p>
        <br><br>
        <p>_________________________<br>Dekode IT</p>
        <br><br>
        <p>_________________________<br>{{customer.name}}</p>
    </div>
</body>
</html>',
'["agreement_number", "date", "customer.name", "customer.email", "customer.phone", "customer.company", "customer.address", "project.name", "agreement.subject"]',
1)
ON DUPLICATE KEY UPDATE name=name;

-- Sample Service Agreements (8 service agreements)
INSERT INTO service_agreements (agreement_number, project_id, template_id, subject, html_content, status, notes, created_by) VALUES
('S250101', 1, 1, 'E-Commerce Website Development Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250101</title></head><body><h1>Service Agreement S250101</h1><p>E-Commerce Website Development Agreement</p></body></html>', 'signed', 'Service agreement for e-commerce project', 1),
('S250102', 2, 1, 'Mobile App Development Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250102</title></head><body><h1>Service Agreement S250102</h1><p>Mobile App Development Agreement</p></body></html>', 'pending', 'Service agreement for mobile app', 1),
('S250103', 4, 2, 'Retail System Development Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250103</title></head><body><h1>Service Agreement S250103</h1><p>Retail System Development Agreement</p></body></html>', 'signed', 'Detailed agreement for retail system', 1),
('S250104', 5, 2, 'Banking Software Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250104</title></head><body><h1>Service Agreement S250104</h1><p>Banking Software Agreement</p></body></html>', 'pending', 'Service agreement for banking system', 1),
('S250105', 6, 1, 'Hospital Management Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250105</title></head><body><h1>Service Agreement S250105</h1><p>Hospital Management Agreement</p></body></html>', 'signed', 'Agreement for hospital system', 1),
('S250106', 7, 1, 'Learning Platform Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250106</title></head><body><h1>Service Agreement S250106</h1><p>Learning Platform Agreement</p></body></html>', 'signed', 'Service agreement for education platform', 1),
('S250107', 8, 1, 'Property Platform Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250107</title></head><body><h1>Service Agreement S250107</h1><p>Property Platform Agreement</p></body></html>', 'rejected', 'Agreement rejected by client', 1),
('S250108', 9, 2, 'Fleet Management Agreement', '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Service Agreement S250108</title></head><body><h1>Service Agreement S250108</h1><p>Fleet Management Agreement</p></body></html>', 'pending', 'Service agreement for logistics system', 1)
ON DUPLICATE KEY UPDATE agreement_number=agreement_number;

-- Display summary
SELECT 'Seed data inserted successfully!' AS message;
SELECT COUNT(*) AS total_users FROM users;
SELECT COUNT(*) AS total_customers FROM customers;
SELECT COUNT(*) AS total_templates FROM proposal_templates;
SELECT COUNT(*) AS total_invoice_templates FROM invoice_templates;
SELECT COUNT(*) AS total_design_document_templates FROM design_document_templates;
SELECT COUNT(*) AS total_service_agreement_templates FROM service_agreement_templates;
SELECT COUNT(*) AS total_projects FROM projects;
SELECT COUNT(*) AS total_proposals FROM proposals;
SELECT COUNT(*) AS total_invoices FROM invoices;
SELECT COUNT(*) AS total_design_documents FROM design_documents;
SELECT COUNT(*) AS total_service_agreements FROM service_agreements;
SELECT COUNT(*) AS total_payments FROM payments;
SELECT COUNT(*) AS total_recurring_bills FROM recurring_bills;
