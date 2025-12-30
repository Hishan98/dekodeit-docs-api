const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { uploadTemplate } = require('../middleware/upload');

router.use(authenticate);

// Proposal Templates
router.get('/proposals', templateController.getProposalTemplates);
router.get('/proposals/:id', templateController.getProposalTemplateById);
router.post('/proposals', roleCheck(['admin']), templateController.createProposalTemplate);
router.put('/proposals/:id', roleCheck(['admin']), templateController.updateProposalTemplate);
router.delete('/proposals/:id', roleCheck(['admin']), templateController.deleteProposalTemplate);

// Invoice Templates
router.get('/invoices', templateController.getInvoiceTemplates);
router.get('/invoices/:id', templateController.getInvoiceTemplateById);
router.post('/invoices', roleCheck(['admin']), templateController.createInvoiceTemplate);
router.put('/invoices/:id', roleCheck(['admin']), templateController.updateInvoiceTemplate);
router.delete('/invoices/:id', roleCheck(['admin']), templateController.deleteInvoiceTemplate);

// Design Document Templates
router.get('/design-documents', templateController.getDesignDocumentTemplates);
router.get('/design-documents/:id', templateController.getDesignDocumentTemplateById);
router.post('/design-documents', roleCheck(['admin']), uploadTemplate.single('file'), templateController.createDesignDocumentTemplate);
router.put('/design-documents/:id', roleCheck(['admin']), uploadTemplate.single('file'), templateController.updateDesignDocumentTemplate);
router.delete('/design-documents/:id', roleCheck(['admin']), templateController.deleteDesignDocumentTemplate);

// Service Agreement Templates
router.get('/service-agreements', templateController.getServiceAgreementTemplates);
router.get('/service-agreements/:id', templateController.getServiceAgreementTemplateById);
router.post('/service-agreements', roleCheck(['admin']), templateController.createServiceAgreementTemplate);
router.put('/service-agreements/:id', roleCheck(['admin']), templateController.updateServiceAgreementTemplate);
router.delete('/service-agreements/:id', roleCheck(['admin']), templateController.deleteServiceAgreementTemplate);

module.exports = router;

