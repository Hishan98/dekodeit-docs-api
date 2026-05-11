const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { uploadPaymentProof } = require('../middleware/upload');

router.use(authenticate);

router.get('/', paymentController.getPayments);
router.get('/project/:projectId', paymentController.getProjectPayments);
router.get('/:id', paymentController.getPaymentById);
router.post('/', roleCheck(['admin']), paymentController.createPayment);
router.post('/:id/proof', roleCheck(['admin']), uploadPaymentProof.single('file'), paymentController.uploadPaymentProofFile);
router.put('/:id', roleCheck(['admin']), paymentController.updatePayment);
router.delete('/:id', roleCheck(['admin']), paymentController.deletePayment);

module.exports = router;

