const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { uploadPurchaseOrder } = require('../middleware/upload');

router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/financials-summary', projectController.getFinancialsSummary);
router.get('/:id', projectController.getProjectById);
router.post('/', roleCheck(['admin']), projectController.createProject);
// More specific routes must come before generic :id routes
router.put('/:id/phase', roleCheck(['admin']), projectController.updateProjectPhase);
router.post('/:id/purchase-order', uploadPurchaseOrder.single('file'), projectController.uploadPurchaseOrder);
router.delete('/:id/purchase-order', projectController.removePurchaseOrder);
router.post('/:id/send-po-request', roleCheck(['admin']), projectController.sendPORequestEmailToCustomer);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;

