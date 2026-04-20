const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticate = require('../middleware/auth');
const { uploadPurchaseOrder } = require('../middleware/upload');

router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
// More specific routes must come before generic :id routes
router.put('/:id/phase', projectController.updateProjectPhase);
router.post('/:id/purchase-order', uploadPurchaseOrder.single('file'), projectController.uploadPurchaseOrder);
router.delete('/:id/purchase-order', projectController.removePurchaseOrder);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;

