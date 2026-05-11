const pool = require('../config/database');

const getMilestoneNotifications = async (req, res) => {
  try {
    const [stages] = await pool.execute(
      `SELECT
         ps.id, ps.stage_name, ps.due_date, ps.amount,
         DATEDIFF(ps.due_date, CURDATE()) AS days_until_due,
         p.currency,
         proj.id AS project_id,
         proj.name AS project_name
       FROM payment_stages ps
       JOIN proposals p ON p.id = ps.proposal_id
       JOIN projects proj ON proj.id = p.project_id
       WHERE ps.status = 'pending'
         AND ps.due_date IS NOT NULL
         AND ps.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ORDER BY ps.due_date ASC`
    );

    const notifications = stages.map((s) => {
      const days = Number(s.days_until_due);
      const urgency = days < 0 ? 'overdue' : days === 0 ? 'today' : 'soon';
      return { ...s, days_until_due: days, urgency };
    });

    res.json({ notifications });
  } catch (error) {
    console.error('Get milestone notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getMilestoneNotifications };
