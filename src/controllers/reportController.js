const pool = require("../config/database");
const ExcelJS = require("exceljs");

const getRevenueReport = async (req, res) => {
  try {
    const { start_date, end_date, client_id } = req.query;

    let query = `
      SELECT
        DATE(i.created_at) as date,
        i.invoice_number,
        cl.company_name as client_name,
        i.final_amount,
        i.status,
        COALESCE(SUM(p.amount), 0) as paid_amount
      FROM invoices i
      LEFT JOIN clients cl ON i.client_id = cl.id
      LEFT JOIN payments p ON i.id = p.invoice_id AND p.payment_type != 'broker_commission' AND p.payment_type != 'developer_payment'
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += " AND DATE(i.created_at) >= ?";
      params.push(start_date);
    }
    if (end_date) {
      query += " AND DATE(i.created_at) <= ?";
      params.push(end_date);
    }
    if (client_id) {
      query += " AND i.client_id = ?";
      params.push(client_id);
    }

    query += " GROUP BY i.id ORDER BY i.created_at DESC";

    const [invoices] = await pool.execute(query, params);

    const totals = invoices.reduce(
      (acc, inv) => {
        acc.total_invoiced += parseFloat(inv.final_amount);
        acc.total_paid += parseFloat(inv.paid_amount);
        return acc;
      },
      { total_invoiced: 0, total_paid: 0 }
    );

    totals.total_outstanding = totals.total_invoiced - totals.total_paid;

    res.json({ invoices, totals });
  } catch (error) {
    console.error("Get revenue report error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getPaymentStatusReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        i.id,
        i.invoice_number,
        cl.company_name as client_name,
        i.final_amount,
        i.status,
        i.due_date,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        (i.final_amount - COALESCE(SUM(p.amount), 0)) as outstanding_amount
      FROM invoices i
      LEFT JOIN clients cl ON i.client_id = cl.id
      LEFT JOIN payments p ON i.id = p.invoice_id AND p.payment_type != 'broker_commission' AND p.payment_type != 'developer_payment'
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += " AND DATE(i.created_at) >= ?";
      params.push(start_date);
    }
    if (end_date) {
      query += " AND DATE(i.created_at) <= ?";
      params.push(end_date);
    }

    query += " GROUP BY i.id ORDER BY i.due_date ASC";

    const [invoices] = await pool.execute(query, params);

    const summary = {
      total_invoices: invoices.length,
      paid: invoices.filter((i) => i.status === "paid").length,
      pending: invoices.filter(
        (i) => i.status === "sent" || i.status === "draft"
      ).length,
      overdue: invoices.filter((i) => {
        if (!i.due_date) return false;
        return new Date(i.due_date) < new Date() && i.status !== "paid";
      }).length,
    };

    res.json({ invoices, summary });
  } catch (error) {
    console.error("Get payment status report error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Revenue by month (exclude draft and cancelled)
    let revenueQuery = `
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(final_amount) as total_revenue,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE status IN ('sent', 'paid', 'overdue')
    `;
    const params = [];

    if (start_date) {
      revenueQuery += " AND DATE(created_at) >= ?";
      params.push(start_date);
    }
    if (end_date) {
      revenueQuery += " AND DATE(created_at) <= ?";
      params.push(end_date);
    }

    revenueQuery +=
      ' GROUP BY DATE_FORMAT(created_at, "%Y-%m") ORDER BY month ASC';

    const [revenueData] = await pool.execute(revenueQuery, params);

    // Project phases distribution - filtered to the same date range as revenue
    let phaseQuery = "SELECT phase, COUNT(*) as count FROM projects WHERE 1=1";
    const phaseParams = [];
    if (start_date) { phaseQuery += " AND DATE(created_at) >= ?"; phaseParams.push(start_date); }
    if (end_date)   { phaseQuery += " AND DATE(created_at) <= ?"; phaseParams.push(end_date); }
    phaseQuery += " GROUP BY phase";
    const [phaseData] = await pool.execute(phaseQuery, phaseParams);

    // Payment types distribution - filtered to the same date range
    let paymentTypeQuery = "SELECT payment_type, SUM(amount) as total FROM payments WHERE 1=1";
    const paymentParams = [];
    if (start_date) { paymentTypeQuery += " AND DATE(payment_date) >= ?"; paymentParams.push(start_date); }
    if (end_date)   { paymentTypeQuery += " AND DATE(payment_date) <= ?"; paymentParams.push(end_date); }
    paymentTypeQuery += " GROUP BY payment_type";
    const [paymentTypeData] = await pool.execute(paymentTypeQuery, paymentParams);

    // Top clients - filtered to the same date range
    let topClientsQuery = `
      SELECT cl.id, cl.company_name as name,
        COUNT(i.id) as invoice_count,
        COALESCE(SUM(i.final_amount), 0) as total_revenue
      FROM clients cl
      LEFT JOIN invoices i ON cl.id = i.client_id
        AND i.status IN ('sent', 'paid', 'overdue')
    `;
    const topParams = [];
    if (start_date) { topClientsQuery += " AND DATE(i.created_at) >= ?"; topParams.push(start_date); }
    if (end_date)   { topClientsQuery += " AND DATE(i.created_at) <= ?"; topParams.push(end_date); }
    topClientsQuery += " GROUP BY cl.id, cl.company_name ORDER BY total_revenue DESC LIMIT 10";
    const [topCustomers] = await pool.execute(topClientsQuery, topParams);

    // Service distribution - only show services with actual projects
    const [serviceData] = await pool.execute(
      `SELECT 
        s.name,
        COUNT(p.id) as project_count,
        COALESCE(SUM(p.total_amount), 0) as total_revenue
       FROM services s
       LEFT JOIN projects p ON s.id = p.service_id
       GROUP BY s.id, s.name
       HAVING COUNT(p.id) > 0
       ORDER BY total_revenue DESC`
    );

    res.json({
      revenue_by_month: revenueData,
      project_phases: phaseData,
      payment_types: paymentTypeData,
      top_customers: topCustomers,
      services: serviceData,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const exportToExcel = async (req, res) => {
  try {
    const { type, start_date, end_date } = req.query;

    const workbook = new ExcelJS.Workbook();
    let worksheet;

    if (type === "revenue") {
      worksheet = workbook.addWorksheet("Revenue Report");

      let query = `
        SELECT 
          i.invoice_number,
          DATE(i.created_at) as date,
          cl.company_name as client_name,
          i.final_amount,
          i.status,
          COALESCE(SUM(p.amount), 0) as paid_amount
        FROM invoices i
        LEFT JOIN clients cl ON i.client_id = cl.id
        LEFT JOIN payments p ON i.id = p.invoice_id AND p.payment_type != 'broker_commission' AND p.payment_type != 'developer_payment'
        WHERE 1=1
      `;
      const params = [];

      if (start_date) {
        query += " AND DATE(i.created_at) >= ?";
        params.push(start_date);
      }
      if (end_date) {
        query += " AND DATE(i.created_at) <= ?";
        params.push(end_date);
      }

      query += " GROUP BY i.id ORDER BY i.created_at DESC";

      const [invoices] = await pool.execute(query, params);

      worksheet.columns = [
        { header: "Invoice Number", key: "invoice_number", width: 15 },
        { header: "Date", key: "date", width: 12 },
        { header: "Client", key: "client_name", width: 30 },
        { header: "Amount", key: "final_amount", width: 15 },
        { header: "Paid", key: "paid_amount", width: 15 },
        { header: "Status", key: "status", width: 12 },
      ];

      invoices.forEach((invoice) => {
        worksheet.addRow({
          invoice_number: invoice.invoice_number,
          date: invoice.date,
          client_name: invoice.client_name,
          final_amount: parseFloat(invoice.final_amount),
          paid_amount: parseFloat(invoice.paid_amount),
          status: invoice.status,
        });
      });
    } else if (type === "payments") {
      worksheet = workbook.addWorksheet("Payments Report");

      let query = `
        SELECT 
          p.payment_date,
          p.payment_type,
          p.amount,
          p.payment_method,
          p.reference_number,
          i.invoice_number,
          cl.company_name as client_name
        FROM payments p
        LEFT JOIN invoices i ON p.invoice_id = i.id
        LEFT JOIN clients cl ON i.client_id = cl.id
        WHERE 1=1
      `;
      const params = [];

      if (start_date) {
        query += " AND DATE(p.payment_date) >= ?";
        params.push(start_date);
      }
      if (end_date) {
        query += " AND DATE(p.payment_date) <= ?";
        params.push(end_date);
      }

      query += " ORDER BY p.payment_date DESC";

      const [payments] = await pool.execute(query, params);

      worksheet.columns = [
        { header: "Date", key: "payment_date", width: 12 },
        { header: "Type", key: "payment_type", width: 20 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Method", key: "payment_method", width: 15 },
        { header: "Reference", key: "reference_number", width: 20 },
        { header: "Invoice", key: "invoice_number", width: 15 },
        { header: "Client", key: "client_name", width: 30 },
      ];

      payments.forEach((payment) => {
        worksheet.addRow({
          payment_date: payment.payment_date,
          payment_type: payment.payment_type,
          amount: parseFloat(payment.amount),
          payment_method: payment.payment_method || "",
          reference_number: payment.reference_number || "",
          invoice_number: payment.invoice_number || "",
          client_name: payment.client_name || "",
        });
      });
    }

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report_${type}_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export to Excel error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getRevenueReport,
  getPaymentStatusReport,
  getAnalytics,
  exportToExcel,
};
