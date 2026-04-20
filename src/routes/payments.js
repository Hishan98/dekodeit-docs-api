const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentById);
router.get('/project/:projectId', paymentController.getProjectPayments);
router.post('/', roleCheck(['admin']), paymentController.createPayment);
router.put('/:id', roleCheck(['admin']), paymentController.updatePayment);
router.delete('/:id', roleCheck(['admin']), paymentController.deletePayment);

module.exports = router;

