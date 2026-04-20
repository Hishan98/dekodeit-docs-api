const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/proposalController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/', proposalController.getProposals);
router.get('/:id', proposalController.getProposalById);
router.post('/', proposalController.createProposal);
router.put('/:id', proposalController.updateProposal);
router.delete('/:id', proposalController.deleteProposal);
router.get('/:id/pdf', proposalController.generateProposalPDF);
router.post('/:id/send-email', proposalController.sendProposalEmailToCustomer);
router.patch('/:id/status', proposalController.updateProposalStatus);

module.exports = router;

