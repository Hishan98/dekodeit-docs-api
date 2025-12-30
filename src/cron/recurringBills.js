const cron = require("node-cron");
const { processRecurringBills } = require("../services/recurringBillService");

/**
 * Cron job to process recurring bills daily at 2 AM
 * This will generate invoices for all recurring bills that are due
 */
const startRecurringBillsCron = () => {
  // Run daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("Processing recurring bills...");
    try {
      const result = await processRecurringBills();
      console.log(
        `Recurring bills processed: ${result.processed} bills, ${result.generated} invoices generated`
      );
    } catch (error) {
      console.error("Error processing recurring bills:", error);
    }
  });

  console.log("Recurring bills cron job started (runs daily at 2:00 AM)");
};

module.exports = {
  startRecurringBillsCron,
};

