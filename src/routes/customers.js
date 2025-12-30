const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authenticate);

// Get all customers (both admin and staff can view)
router.get('/', customerController.getCustomers);

// Get customer by ID (both admin and staff can view)
router.get('/:id', customerController.getCustomerById);

// Create, update, delete - Admin only
router.post('/', roleCheck(['admin']), customerController.createCustomer);
router.put('/:id', roleCheck(['admin']), customerController.updateCustomer);
router.delete('/:id', roleCheck(['admin']), customerController.deleteCustomer);

module.exports = router;

