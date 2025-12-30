const express = require('express');
const router = express.Router();
const serviceAgreementController = require('../controllers/serviceAgreementController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', serviceAgreementController.getServiceAgreements);
router.get('/:id', serviceAgreementController.getServiceAgreementById);
router.post('/', serviceAgreementController.createServiceAgreement);
// More specific routes must come before generic :id routes
router.put('/:id/status', serviceAgreementController.updateServiceAgreementStatus);
router.put('/:id', serviceAgreementController.updateServiceAgreement);
router.delete('/:id', roleCheck(['admin']), serviceAgreementController.deleteServiceAgreement);
router.get('/:id/pdf', serviceAgreementController.downloadServiceAgreementPDF);

module.exports = router;

