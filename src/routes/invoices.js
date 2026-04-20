const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.get('/:id/pdf', invoiceController.generateInvoicePDF);
router.post('/', roleCheck(['admin']), invoiceController.createInvoice);
router.post('/:id/send-email', roleCheck(['admin']), invoiceController.sendInvoiceEmailToCustomer);
router.put('/:id', roleCheck(['admin']), invoiceController.updateInvoice);
router.delete('/:id', roleCheck(['admin']), invoiceController.deleteInvoice);

module.exports = router;

