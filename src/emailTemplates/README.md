# Email Templates

This folder contains HTML email templates used by the email service. Templates use `{{variable}}` syntax for dynamic content replacement.

## Available Templates

### 1. `proposal.html`
**Purpose:** Send proposal documents to customers
**Variables:**
- `{{customerName}}` - Customer's name
- `{{proposalNumber}}` - Proposal number (e.g., P251101)

### 2. `invoice.html`
**Purpose:** Send invoice documents to customers
**Variables:**
- `{{customerName}}` - Customer's name
- `{{invoiceNumber}}` - Invoice number (e.g., D251101)

### 3. `otp.html`
**Purpose:** Send password reset OTP to users
**Variables:**
- `{{userName}}` - User's name (defaults to "User" if empty)
- `{{otp}}` - One-time password code

### 4. `invoiceReminder.html`
**Purpose:** Send payment reminders for overdue invoices
**Variables:**
- `{{customerName}}` - Customer's name
- `{{invoiceNumber}}` - Invoice number
- `{{dueDate}}` - Invoice due date
- `{{amount}}` - Amount due

### 5. `customerFollowup.html`
**Purpose:** Send project updates and follow-ups to customers
**Variables:**
- `{{customerName}}` - Customer's name
- `{{projectName}}` - Project name
- `{{currentPhase}}` - Current project phase
- `{{status}}` - Project status
- `{{nextSteps}}` - Next steps in the project
- `{{customMessage}}` - Additional custom message

## Usage

Templates are automatically loaded by the `sendEmail` function in `emailService.js`. Use the specific email functions or the generic `sendEmail` function:

```javascript
const { sendEmail } = require('./services/emailService');

// Using specific function
await sendInvoiceReminderEmail('customer@email.com', 'John Doe', 'D251101', '2024-01-15', '$500.00');

// Using generic function
await sendEmail({
  to: 'customer@email.com',
  subject: 'Custom Subject',
  templateName: 'invoiceReminder',
  variables: {
    customerName: 'John Doe',
    invoiceNumber: 'D251101',
    dueDate: '2024-01-15',
    amount: '$500.00'
  },
  attachments: [] // optional
});
```

## Adding New Templates

1. Create a new `.html` file in this folder
2. Use `{{variableName}}` for dynamic content
3. Update the email service functions or use the generic `sendEmail` function
4. Document the template in this README

## Styling Guidelines

- Use inline CSS for better email client compatibility
- Keep designs clean and professional
- Use the Dekode IT brand colors:
  - Primary: #ea580c (orange)
  - Danger: #dc2626 (red)
  - Success: #059669 (green)
- Max width: 600px for optimal display