const express = require('express');
const router = express.Router();
const serviceAgreementController = require('../controllers/serviceAgreementController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { uploadServiceAgreementFile } = require('../middleware/upload');

router.use(authenticate);

// Static-path routes must come before /:id param routes
router.post('/upload', roleCheck(['admin']), uploadServiceAgreementFile.single('file'), serviceAgreementController.uploadServiceAgreement);

router.get('/', serviceAgreementController.getServiceAgreements);
router.get('/:id', serviceAgreementController.getServiceAgreementById);
router.post('/', roleCheck(['admin']), serviceAgreementController.createServiceAgreement);
router.post('/:id/send-email', roleCheck(['admin']), serviceAgreementController.sendServiceAgreementEmailToCustomer);
router.put('/:id/status', roleCheck(['admin']), serviceAgreementController.updateServiceAgreementStatus);
router.put('/:id', roleCheck(['admin']), serviceAgreementController.updateServiceAgreement);
router.delete('/:id', roleCheck(['admin']), serviceAgreementController.deleteServiceAgreement);
router.get('/:id/pdf', serviceAgreementController.downloadServiceAgreementPDF);
router.post('/:id/replace-file', roleCheck(['admin']), uploadServiceAgreementFile.single('file'), serviceAgreementController.replaceServiceAgreementFile);

module.exports = router;
