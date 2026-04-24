const router  = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');
const { generateNudgeMessage, generatePreReviewBrief, generateReviewAgenda, generateReviewSummary } = require('../services/ai');

// ── AI usage limit helper ──────────────────────────────────────
// Limits: project_quick_glance and review_summary = 2/day
//         weekly_report = 2/week
async function checkAndLogAIUsage(client, tenantId, projectId, feature, userId) {
  await client.query(`SET app.tenant_id = '${tenantId}'`)
  const windowHours = feature === 'weekly_report' ? 168 : 24 // 7 days or 1 day
  const limit = 2
  const result = await client.query(`
    SELECT COUNT(*) FROM ai_usage_log
    WHERE project_id = $1 AND feature = $2
    AND used_at > NOW() - INTERVAL '${windowHours} hours'
  `, [projectId, feature])
  const used = parseInt(result.rows[0].count)
  if (used >= limit) {
    const period = feature === 'weekly_report' ? 'week' : 'day'
    throw { status: 429, message: `AI limit reached: ${limit} uses per ${period} per project. Try again later.` }
  }
  await client.query(`
    INSERT INTO ai_usage_log (project_id, tenant_id, feature, used_by)
    VALUES ($1, $2, $3, $4)
  `, [projectId, tenantId, feature, userId || null])
}



// ─────────────────────────────────────────────
// POST /api/projects/:projectId/nudges/:taskId
// Generate and send a nudge for a delayed task
// Access: PM only
// ─────────────────────────────────────────────
router.post('/:taskId', requireRole('pm'), async (req, res) => {
  const { projectId, taskId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);

    // Fetch task and project
    const taskResult = await client.query(
      `SELECT t.*, p.project_name FROM tasks t
       JOIN projects p ON p.project_id = t.project_id
       WHERE t.task_id = $1 AND t.tenant_id = $2`,
      [taskId, req.tenantId]
    );
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = taskResult.rows[0];

    if (task.delay_days === 0) {
      return res.status(400).json({ error: 'Task is not delayed — no nudge needed' });
    }

    // Generate nudge message via AI
    const message = await generateNudgeMessage({
      taskName:         task.task_name,
      ownerName:        task.owner_email || 'Task Owner',
      delayDays:        task.delay_days,
      plannedEndDate:   task.planned_end_date,
      currentEcd:       task.current_ecd,
      slippageCount:    task.slippage_count,
      controlType:      task.control_type,
      projectName:      task.project_name,
      acceptanceCriteria: task.acceptance_criteria
    });

    // Log nudge in audit log
    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
      VALUES ($1, 'nudge_sent', 'task', $2, $3, $4)
    `, [req.tenantId, taskId, req.userId,
        JSON.stringify({ message, delay_days: task.delay_days })]);

    res.json({
      task_id:    taskId,
      task_name:  task.task_name,
      owner:      task.owner_email,
      delay_days: task.delay_days,
      message:    message || 'AI unavailable — please follow up manually.',
      generated_at: new Date().toISOString()
    });

  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/pre-review-brief
// AI-generated summary before PM opens a review
// ─────────────────────────────────────────────
router.get('/pre-review-brief', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await checkAndLogAIUsage(client, req.tenantId, projectId, 'project_quick_glance', req.userId)

    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    const tasksResult = await client.query(`
      SELECT t.*, latest_u.what_pending AS last_update_pending, latest_u.created_at AS last_update_at
      FROM tasks t
      LEFT JOIN LATERAL (
        SELECT what_pending, created_at FROM task_updates
        WHERE task_id = t.task_id ORDER BY created_at DESC LIMIT 1
      ) latest_u ON true
      WHERE t.project_id = $1 AND t.tenant_id = $2
    `, [projectId, req.tenantId]);
    const tasks = tasksResult.rows;
    const highRiskCount = tasks.filter(t => t.risk_label === 'high_risk').length;

    const brief = await generatePreReviewBrief(project, tasks);

    res.json({
      project_id:   projectId,
      project_name: project.project_name,
      brief:        brief || 'Brief unavailable — please review task list manually.',
      generated_at: new Date().toISOString()
    });

  } catch(err) {
    if (err.status === 429) return res.status(429).json({ error: err.message })
    console.error('pre-review-brief error:', err)
    return res.status(500).json({ error: 'Failed to generate brief. Please try again.' })
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/nudges/review-agenda
// AI-generated structured review agenda from task data
// ─────────────────────────────────────────────
router.get('/review-agenda', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);

    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    // Get tasks with latest update info
    const tasksResult = await client.query(`
      SELECT
        t.*,
        pp.phase_name,
        latest_u.what_pending   AS last_update_pending,
        latest_u.created_at     AS last_update_at
      FROM tasks t
      LEFT JOIN project_phases pp ON pp.phase_id = t.phase_id
      LEFT JOIN LATERAL (
        SELECT what_pending, created_at
        FROM task_updates
        WHERE task_id = t.task_id
        ORDER BY created_at DESC
        LIMIT 1
      ) latest_u ON true
      WHERE t.project_id = $1 AND t.tenant_id = $2
      ORDER BY t.risk_number DESC
    `, [projectId, req.tenantId]);

    // Get last review date
    const lastReviewResult = await client.query(`
      SELECT review_date, attended_by FROM reviews
      WHERE project_id = $1
      ORDER BY review_date DESC LIMIT 1
    `, [projectId]);
    const lastReviewDate = lastReviewResult.rows[0]?.review_date || null;

    const agenda = await generateReviewAgenda({
      projectName:    project.project_name,
      opv:            parseFloat(project.opv),
      lfv:            parseFloat(project.lfv),
      momentum:       parseFloat(project.momentum),
      tasks:          tasksResult.rows,
      lastReviewDate
    });

    res.json({
      project_id:   projectId,
      generated_at: new Date().toISOString(),
      next_review_due: project.next_review_due,
      last_review_date: lastReviewDate,
      agenda
    });

  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/nudges/review-summary
// AI bullet point summary for review
// ─────────────────────────────────────────────
router.get('/review-summary', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await checkAndLogAIUsage(client, req.tenantId, projectId, 'review_summary', req.userId)

    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    const tasksResult = await client.query(`
      SELECT t.*, pp.phase_name,
        latest_u.what_pending AS last_update_pending,
        latest_u.created_at  AS last_update_at
      FROM tasks t
      LEFT JOIN project_phases pp ON pp.phase_id = t.phase_id
      LEFT JOIN LATERAL (
        SELECT what_pending, created_at FROM task_updates
        WHERE task_id = t.task_id ORDER BY created_at DESC LIMIT 1
      ) latest_u ON true
      WHERE t.project_id = $1 AND t.tenant_id = $2
      ORDER BY t.risk_number DESC
    `, [projectId, req.tenantId]);

    const lastReviewResult = await client.query(
      `SELECT review_date FROM reviews WHERE project_id = $1 ORDER BY review_date DESC LIMIT 1`,
      [projectId]
    );
    const lastReviewDate = lastReviewResult.rows[0]?.review_date || null;

    const summary = await generateReviewSummary({
      projectName:    project.project_name,
      opv:            parseFloat(project.opv),
      lfv:            parseFloat(project.lfv),
      momentum:       parseFloat(project.momentum),
      tasks:          tasksResult.rows,
      lastReviewDate
    });

    res.json({
      project_id:   projectId,
      generated_at: new Date().toISOString(),
      summary:      summary || 'Summary unavailable — please review task list manually.'
    });

  } catch(err) {
    if (err.status === 429) return res.status(429).json({ error: err.message })
    console.error('pre-review-brief error:', err)
    return res.status(500).json({ error: 'Failed to generate brief. Please try again.' })
  } finally {
    client.release();
  }
});

module.exports = router;
