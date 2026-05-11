const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = {
  templates: path.join(__dirname, '../../uploads/templates'),
  designDocuments: path.join(__dirname, '../../uploads/design-documents'),
  pdfs: path.join(__dirname, '../../uploads/pdfs'),
  purchaseOrders: path.join(__dirname, '../../uploads/purchase-orders'),
  proposals: path.join(__dirname, '../../uploads/proposals'),
  serviceAgreements: path.join(__dirname, '../../uploads/service-agreements'),
  paymentProofs: path.join(__dirname, '../../uploads/payment-proofs'),
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for design document templates (.docx files)
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.templates);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `dd-template-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Storage configuration for design documents (.docx files)
const designDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.designDocuments);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `design-doc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Storage configuration for purchase order documents (PDF, doc, docx, images)
const purchaseOrderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.purchaseOrders);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `po-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter for purchase orders (PDF, doc, docx, images)
const poFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, Word documents, and images are allowed'), false);
  }
};

// File filter for .docx files
const docxFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  const allowedExts = ['.docx', '.doc'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .docx and .doc files are allowed'), false);
  }
};

// Multer instances
const uploadTemplate = multer({
  storage: templateStorage,
  fileFilter: docxFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const uploadDesignDocument = multer({
  storage: designDocumentStorage,
  fileFilter: docxFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const uploadPurchaseOrder = multer({
  storage: purchaseOrderStorage,
  fileFilter: poFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Storage configuration for uploaded proposal documents (PDF, docx, doc)
const proposalFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.proposals);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `proposal-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter for proposal uploads (PDF and Word only)
const proposalFileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents (.pdf, .docx, .doc) are allowed'), false);
  }
};

const uploadProposalFile = multer({
  storage: proposalFileStorage,
  fileFilter: proposalFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Storage configuration for uploaded service agreement documents (PDF, docx, doc)
const serviceAgreementFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.serviceAgreements);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `service-agreement-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const serviceAgreementFileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents (.pdf, .docx, .doc) are allowed'), false);
  }
};

const uploadServiceAgreementFile = multer({
  storage: serviceAgreementFileStorage,
  fileFilter: serviceAgreementFileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Storage configuration for payment proof / bank slip uploads
const paymentProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.paymentProofs);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `proof-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const paymentProofFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and image files (JPG, PNG, WEBP) are allowed'), false);
  }
};

const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  fileFilter: paymentProofFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = {
  uploadTemplate,
  uploadDesignDocument,
  uploadPurchaseOrder,
  uploadProposalFile,
  uploadServiceAgreementFile,
  uploadPaymentProof,
  uploadDirs,
};

