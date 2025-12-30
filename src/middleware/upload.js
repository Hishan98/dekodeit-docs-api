const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = {
  templates: path.join(__dirname, '../../uploads/templates'),
  designDocuments: path.join(__dirname, '../../uploads/design-documents'),
  pdfs: path.join(__dirname, '../../uploads/pdfs'),
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

module.exports = {
  uploadTemplate,
  uploadDesignDocument,
  uploadDirs,
};

