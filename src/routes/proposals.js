const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/proposalController');
const authenticate = require('../middleware/auth');
const { uploadProposalFile } = require('../middleware/upload');

router.use(authenticate);

// Static-path routes MUST come before /:id param routes to avoid conflicts
router.post('/upload',              uploadProposalFile.single('file'), proposalController.uploadProposal);

router.get('/',                     proposalController.getProposals);
router.get('/:id',                  proposalController.getProposalById);
router.post('/',                    proposalController.createProposal);
router.put('/:id',                  proposalController.updateProposal);
router.delete('/:id',               proposalController.deleteProposal);
router.get('/:id/pdf',              proposalController.generateProposalPDF);
router.post('/:id/send-email',      proposalController.sendProposalEmailToCustomer);
router.patch('/:id/status',         proposalController.updateProposalStatus);
router.post('/:id/replace-file',    uploadProposalFile.single('file'), proposalController.replaceProposalFile);

module.exports = router;

