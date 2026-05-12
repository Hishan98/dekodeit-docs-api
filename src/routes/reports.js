const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authenticate);
router.use(roleCheck(['admin']));

router.get('/revenue', reportController.getRevenueReport);
router.get('/payments', reportController.getPaymentStatusReport);
router.get('/analytics', reportController.getAnalytics);
router.get('/export', reportController.exportToExcel);

module.exports = router;

