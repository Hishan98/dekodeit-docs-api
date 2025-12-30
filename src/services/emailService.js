const nodemailer = require("nodemailer");
const fs = require("fs").promises;
const path = require("path");

// Create transporter (configure with your email settings)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send proposal email to customer
 */
async function sendProposalEmail(
  customerEmail,
  customerName,
  proposalNumber,
  pdfPath
) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Dekode IT" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Proposal ${proposalNumber} - Dekode IT`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">Dear ${customerName},</h2>
          <p>Thank you for your interest in our services. Please find attached our proposal <strong>${proposalNumber}</strong> for your review.</p>
          <p>We look forward to working with you.</p>
          <p>Best regards,<br><strong>Dekode IT Team</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `proposal_${proposalNumber}.pdf`,
          path: pdfPath,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Proposal email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending proposal email:", error);
    throw error;
  }
}

/**
 * Send invoice email to customer
 */
async function sendInvoiceEmail(
  customerEmail,
  customerName,
  invoiceNumber,
  pdfPath
) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Dekode IT" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} - Dekode IT`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">Dear ${customerName},</h2>
          <p>Please find attached invoice <strong>${invoiceNumber}</strong> for your review and payment.</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br><strong>Dekode IT Team</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `invoice_${invoiceNumber}.pdf`,
          path: pdfPath,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Invoice email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending invoice email:", error);
    throw error;
  }
}

/**
 * Send OTP email for password reset
 */
async function sendOTPEmail(userEmail, userName, otp) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"Dekode IT" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: "Password Reset OTP - Dekode IT",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0;">DEKODE IT</h1>
          </div>
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Dear ${userName || "User"},</p>
          <p>You have requested to reset your password. Please use the following OTP (One-Time Password) to verify your identity:</p>
          <div style="background-color: #f3f4f6; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <h1 style="color: #dc2626; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP will expire in 15 minutes. Please do not share this code with anyone.</p>
          <p style="color: #666; font-size: 14px;">If you did not request this password reset, please ignore this email.</p>
          <p style="margin-top: 30px;">Best regards,<br><strong>Dekode IT Team</strong></p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw error;
  }
}

module.exports = {
  sendProposalEmail,
  sendInvoiceEmail,
  sendOTPEmail,
};
