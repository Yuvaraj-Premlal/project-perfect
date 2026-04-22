const router = require('express').Router();
const { callAI } = require('../services/ai');
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');
const { pool } = require('../db');

// ─── SNAPSHOT ─────────────────────────────────────────────────────
router.get('/snapshot', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS active_projects,
      COUNT(*) FILTER (WHERE status = 'closed') AS closed_projects,
      ROUND(AVG(opv) FILTER (WHERE status = 'active')::numeric, 2) AS avg_opv,
      ROUND(AVG(lfv) FILTER (WHERE status = 'active')::numeric, 2) AS avg_lfv,
      COUNT(*) FILTER (WHERE status = 'active' AND opv >= 0.8) AS on_track,
      COUNT(*) FILTER (WHERE status = 'active' AND opv >= 0.7 AND opv < 0.8) AS at_risk,
      COUNT(*) FILTER (WHERE status = 'active' AND opv < 0.7) AS out_of_control
    FROM projects WHERE tenant_id = $1
  `, [req.tenantId]);

  const tasks = await dbQuery(req.tenantId, `
    SELECT COUNT(*) FILTER (WHERE t.completion_status != 'complete' AND t.current_ecd < CURRENT_DATE) AS overdue_tasks
    FROM tasks t
    JOIN projects p ON p.project_id = t.project_id
    WHERE t.tenant_id = $1 AND p.status = 'active'
  `, [req.tenantId]);

  const apqp = await dbQuery(req.tenantId, `
    SELECT COUNT(*) FILTER (WHERE ae.status != 'complete' AND ae.planned_end_date < CURRENT_DATE) AS overdue_apqp
    FROM project_apqp_elements ae
    JOIN projects p ON p.project_id = ae.project_id
    WHERE ae.tenant_id = $1 AND p.status = 'active'
  `, [req.tenantId]);

  res.json({
    ...result.rows[0],
    overdue_tasks: parseInt(tasks.rows[0].overdue_tasks) || 0,
    overdue_apqp:  parseInt(apqp.rows[0].overdue_apqp) || 0,
  });
});

// ─── RESOURCE LOAD ────────────────────────────────────────────────
router.get('/resources', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  // Registered users with task load
  const users = await dbQuery(req.tenantId, `
    SELECT
      u.user_id, u.full_name, u.role, u.department_id,
      COUNT(t.task_id) FILTER (WHERE t.completion_status != 'complete') AS active_tasks,
      COUNT(DISTINCT t.project_id) AS project_count,
      COUNT(t.task_id) FILTER (WHERE t.completion_status != 'complete' AND t.current_ecd < CURRENT_DATE) AS overdue_tasks
    FROM users u
    LEFT JOIN tasks t ON t.owner_user_id = u.user_id AND t.tenant_id = $1
    LEFT JOIN projects p ON p.project_id = t.project_id AND p.status = 'active'
    WHERE u.tenant_id = $1 AND u.is_active = true AND u.role != 'super_user'
    GROUP BY u.user_id, u.full_name, u.role, u.department_id
    ORDER BY active_tasks DESC
  `, [req.tenantId]);

  // Registered suppliers with task load
  const suppliers = await dbQuery(req.tenantId, `
    SELECT
      s.supplier_id, s.supplier_name, s.supplier_type,
      COUNT(t.task_id) FILTER (WHERE t.completion_status != 'complete') AS active_tasks,
      COUNT(DISTINCT t.project_id) AS project_count,
      COUNT(t.task_id) FILTER (WHERE t.completion_status != 'complete' AND t.current_ecd < CURRENT_DATE) AS overdue_tasks
    FROM suppliers s
    LEFT JOIN tasks t ON t.supplier_id = s.supplier_id AND t.tenant_id = $1
    LEFT JOIN projects p ON p.project_id = t.project_id AND p.status = 'active'
    WHERE s.tenant_id = $1
    GROUP BY s.supplier_id, s.supplier_name, s.supplier_type
    ORDER BY active_tasks DESC
  `, [req.tenantId]);

  res.json({ users: users.rows, suppliers: suppliers.rows });
});

// ─── GENERATE INSIGHTS ────────────────────────────────────────────
router.post('/insights/generate', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const tenantId = req.tenantId;

  // 1. Portfolio summary
  const projects = await dbQuery(tenantId, `
    SELECT project_id, project_name, customer_name, status, opv, lfv,
           planned_end_date, ecd_algorithmic, risk_tier,
           ROUND(((COALESCE(ecd_algorithmic::date, planned_end_date::date) - planned_end_date::date))::numeric,0) AS delay_days
    FROM projects WHERE tenant_id = $1 AND status IN ('active','closed')
    ORDER BY status, opv ASC
  `, [tenantId]);

  // 2. Task slippage summary per project
  const slippage = await dbQuery(tenantId, `
    SELECT t.project_id, t.task_name, t.control_type, u.full_name AS owner_name,
           COUNT(tsh.slippage_id) AS slip_count,
           MAX(tsh.delay_increase_days) AS max_slip_days
    FROM tasks t
    JOIN task_slippage_history tsh ON tsh.task_id = t.task_id
    LEFT JOIN users u ON u.user_id = t.owner_user_id
    WHERE t.tenant_id = $1
    GROUP BY t.project_id, t.task_id, t.task_name, t.control_type, u.full_name
    ORDER BY slip_count DESC
    LIMIT 30
  `, [tenantId]);

  // 3. Recent task updates — last 30 days
  const updates = await dbQuery(tenantId, `
    SELECT tu.what_done, tu.what_pending, tu.issue_blocker, tu.created_by_name,
           tu.created_at, t.task_name, t.project_id,
           COALESCE(LENGTH(tu.what_done),0) + COALESCE(LENGTH(tu.what_pending),0) AS text_length
    FROM task_updates tu
    JOIN tasks t ON t.task_id = tu.task_id
    WHERE tu.tenant_id = $1 AND tu.created_at > NOW() - INTERVAL '30 days'
    ORDER BY tu.created_at DESC
    LIMIT 100
  `, [tenantId]);

  // 4. Review responses — last 3 per project
  const reviews = await dbQuery(tenantId, `
    SELECT r.project_id, r.review_date, r.review_responses, r.attended_by,
           p.project_name
    FROM reviews r
    JOIN projects p ON p.project_id = r.project_id
    WHERE r.tenant_id = $1
    ORDER BY r.review_date DESC
    LIMIT 20
  `, [tenantId]);

  // 5. APQP status
  const apqp = await dbQuery(tenantId, `
    SELECT ae.project_id, p.project_name, ae.element_name,
           ae.status, ae.planned_end_date, ae.completed_date,
           CASE WHEN ae.status != 'complete' AND ae.planned_end_date < CURRENT_DATE
                THEN (CURRENT_DATE - ae.planned_end_date::date)
                ELSE 0 END AS overdue_days
    FROM project_apqp_elements ae
    JOIN projects p ON p.project_id = ae.project_id
    WHERE ae.tenant_id = $1
    ORDER BY overdue_days DESC
  `, [tenantId]);

  // 6. Resource load
  const resources = await dbQuery(tenantId, `
    SELECT u.full_name, u.role,
           COUNT(t.task_id) FILTER (WHERE t.completion_status != 'complete') AS active_tasks,
           COUNT(DISTINCT t.project_id) AS project_count,
           COUNT(t.task_id) FILTER (WHERE t.completion_status != 'complete' AND t.current_ecd < CURRENT_DATE) AS overdue_tasks,
           ARRAY_AGG(DISTINCT p.project_name) FILTER (WHERE p.project_name IS NOT NULL) AS projects
    FROM users u
    LEFT JOIN tasks t ON t.owner_user_id = u.user_id AND t.tenant_id = $1
    LEFT JOIN projects p ON p.project_id = t.project_id AND p.status = 'active'
    WHERE u.tenant_id = $1 AND u.is_active = true
    GROUP BY u.user_id, u.full_name, u.role
    HAVING COUNT(t.task_id) > 0
    ORDER BY active_tasks DESC
  `, [tenantId]);

  // 7. Closed project summary
  const closed = await dbQuery(tenantId, `
    SELECT project_name, customer_name, planned_end_date, actual_end_date,
           closure_notes,
           (actual_end_date::date - planned_end_date::date) AS delay_days
    FROM projects WHERE tenant_id = $1 AND status = 'closed'
    ORDER BY closed_at DESC LIMIT 10
  `, [tenantId]);

  // Flag low quality updates
  const lowQualityUpdates = updates.rows.filter(u => u.text_length < 15);
  const goodUpdates = updates.rows.filter(u => u.text_length >= 15);

  // Build AI prompt
  const prompt = `You are an analytics engine for a manufacturing project management platform called Project Perfect. 
Analyse the following data across all projects for this organisation and generate 6-10 specific, actionable insights.

IMPORTANT RULES:
- Every insight must name specific projects, people, or elements — no generic observations
- Flag any patterns where issues raised in reviews are not followed up in task updates
- Flag data quality issues where task updates are too short or generic (under 10 characters)
- If APQP data exists, include APQP-specific insights
- Include resource overload insights if any user has tasks in 3+ projects
- Be honest if data is insufficient for meaningful insights in any area
- Tone: direct, professional, actionable

PORTFOLIO DATA:
${JSON.stringify(projects.rows, null, 2)}

TASK SLIPPAGE (top 30):
${JSON.stringify(slippage.rows, null, 2)}

RECENT TASK UPDATES (quality filtered):
Good updates (${goodUpdates.length}): ${JSON.stringify(goodUpdates.slice(0, 30), null, 2)}
Low quality updates (${lowQualityUpdates.length} flagged — under 10 chars): ${JSON.stringify(lowQualityUpdates.slice(0, 20), null, 2)}

REVIEW RESPONSES (last 20):
${JSON.stringify(reviews.rows, null, 2)}

APQP STATUS:
${JSON.stringify(apqp.rows, null, 2)}

RESOURCE LOAD:
${JSON.stringify(resources.rows, null, 2)}

CLOSED PROJECTS:
${JSON.stringify(closed.rows, null, 2)}

Respond ONLY with a valid JSON object in this exact format:
{
  "data_warnings": ["warning 1", "warning 2"],
  "insights": [
    {
      "type": "alert|warning|info|positive",
      "tag": "Supplier Risk|Resource|APQP|Review Pattern|Trend|Data Quality",
      "text": "Specific insight text naming projects/people",
      "ref": "→ Specific reference to projects/people/elements"
    }
  ]
}`;

  // Call Azure OpenAI
  const systemPrompt = 'You are an analytics engine for a manufacturing project management platform. Always respond with valid JSON only - no markdown, no preamble.';
  const rawText = await callAI(systemPrompt, prompt, 4000) || '{}';
  let parsed;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch(e) {
    return res.status(500).json({ error: 'AI response could not be parsed', raw: rawText });
  }

  // Build snapshot
  const snapshotRes = await dbQuery(tenantId, `
    SELECT COUNT(*) FILTER (WHERE status='active') AS active,
           ROUND(AVG(opv) FILTER (WHERE status='active')::numeric,2) AS avg_opv
    FROM projects WHERE tenant_id = $1
  `, [tenantId]);

  const snapshot = snapshotRes.rows[0];

  // Store result
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${tenantId}'`);
    const saved = await client.query(
      `INSERT INTO analytics_insights (tenant_id, generated_by, insights, data_warnings, snapshot)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, generated_at`,
      [tenantId, req.userId, JSON.stringify(parsed.insights || []),
       JSON.stringify(parsed.data_warnings || []), JSON.stringify(snapshot)]
    );
    res.json({
      id: saved.rows[0].id,
      generated_at: saved.rows[0].generated_at,
      insights: parsed.insights || [],
      data_warnings: parsed.data_warnings || [],
      snapshot
    });
  } finally { client.release(); }
});

// ─── GET LATEST INSIGHTS ──────────────────────────────────────────
router.get('/insights/latest', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT ai.*, u.full_name AS generated_by_name
    FROM analytics_insights ai
    LEFT JOIN users u ON u.user_id = ai.generated_by
    WHERE ai.tenant_id = $1
    ORDER BY ai.generated_at DESC LIMIT 1
  `, [req.tenantId]);
  if (result.rows.length === 0) return res.json(null);
  res.json(result.rows[0]);
});

// ─── GET HISTORY ──────────────────────────────────────────────────
router.get('/insights/history', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT ai.id, ai.generated_at, ai.snapshot, u.full_name AS generated_by_name
    FROM analytics_insights ai
    LEFT JOIN users u ON u.user_id = ai.generated_by
    WHERE ai.tenant_id = $1
    ORDER BY ai.generated_at DESC
  `, [req.tenantId]);
  res.json(result.rows);
});

// ─── GET SPECIFIC HISTORICAL INSIGHT ─────────────────────────────
router.get('/insights/:id', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT ai.*, u.full_name AS generated_by_name
    FROM analytics_insights ai
    LEFT JOIN users u ON u.user_id = ai.generated_by
    WHERE ai.id = $1 AND ai.tenant_id = $2
  `, [req.params.id, req.tenantId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

module.exports = router;
