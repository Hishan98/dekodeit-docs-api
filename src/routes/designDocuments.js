const express = require('express');
const router = express.Router();
const designDocumentController = require('../controllers/designDocumentController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { uploadDesignDocument } = require('../middleware/upload');

router.use(authenticate);

router.get('/', designDocumentController.getDesignDocuments);
router.get('/:id', designDocumentController.getDesignDocumentById);
router.post('/', roleCheck(['admin']), uploadDesignDocument.single('file'), designDocumentController.createDesignDocument);
// More specific routes must come before generic :id routes
router.put('/:id/status', roleCheck(['admin']), designDocumentController.updateDesignDocumentStatus);
router.put('/:id', roleCheck(['admin']), uploadDesignDocument.single('file'), designDocumentController.updateDesignDocument);
router.delete('/:id', roleCheck(['admin']), designDocumentController.deleteDesignDocument);
router.get('/:id/download', designDocumentController.downloadDesignDocument);

module.exports = router;

