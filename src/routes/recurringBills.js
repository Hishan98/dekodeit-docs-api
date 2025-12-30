const express = require("express");
const router = express.Router();
const recurringBillController = require("../controllers/recurringBillController");
const authenticate = require("../middleware/auth");

router.use(authenticate);

router.get("/", recurringBillController.getRecurringBills);
router.get("/:id", recurringBillController.getRecurringBillById);
router.post("/", recurringBillController.createRecurringBill);
router.put("/:id", recurringBillController.updateRecurringBill);
router.delete("/:id", recurringBillController.deleteRecurringBill);

module.exports = router;

