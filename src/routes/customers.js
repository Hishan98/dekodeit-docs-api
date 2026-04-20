const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authenticate);

// Get all customers (both admin and staff can view)
router.get('/', customerController.getCustomers);

// Specific sub-routes must come before /:id to avoid param capture
router.get('/:id/linked', roleCheck(['admin']), customerController.getLinkedRecords);

// Get customer by ID (both admin and staff can view)
router.get('/:id', customerController.getCustomerById);

// Create, update, archive - Admin only
router.post('/', roleCheck(['admin']), customerController.createCustomer);
router.put('/:id', roleCheck(['admin']), customerController.updateCustomer);
router.patch('/:id/status', roleCheck(['admin']), customerController.updateCustomerStatus);
// DELETE archives the customer (soft delete — row is kept, status → archived)
router.delete('/:id', roleCheck(['admin']), customerController.deleteCustomer);

module.exports = router;

