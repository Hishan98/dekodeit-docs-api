const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authenticate);

// Get all clients (both admin and staff can view)
router.get('/', clientController.getClients);

// Specific sub-routes must come before /:id to avoid param capture
router.get('/:id/linked', roleCheck(['admin']), clientController.getLinkedRecords);

// Get client by ID (both admin and staff can view)
router.get('/:id', clientController.getClientById);

// Create, update, archive — Admin only
router.post('/', roleCheck(['admin']), clientController.createClient);
router.put('/:id', roleCheck(['admin']), clientController.updateClient);
router.patch('/:id/status', roleCheck(['admin']), clientController.updateClientStatus);
// DELETE archives the client (soft delete — row is kept, status → archived)
router.delete('/:id', roleCheck(['admin']), clientController.deleteClient);

// Contact sub-resource — Admin only
router.post('/:id/contacts', roleCheck(['admin']), clientController.addContact);
router.put('/:id/contacts/:contactId', roleCheck(['admin']), clientController.updateContact);
router.delete('/:id/contacts/:contactId', roleCheck(['admin']), clientController.deleteContact);

module.exports = router;
