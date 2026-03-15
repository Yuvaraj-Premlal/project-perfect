const router  = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');
const { generateNudgeMessage, generatePreReviewBrief } = require('../services/ai');

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
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);

    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    const tasksResult = await client.query(
      `SELECT * FROM tasks WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    const tasks = tasksResult.rows;
    const highRiskCount = tasks.filter(t => t.risk_label === 'high_risk').length;

    const brief = await generatePreReviewBrief({
      projectName:    project.project_name,
      opv:            parseFloat(project.opv),
      lfv:            parseFloat(project.lfv),
      momentum:       parseFloat(project.momentum),
      highRiskTasks:  highRiskCount,
      tasks
    });

    res.json({
      project_id:   projectId,
      project_name: project.project_name,
      brief:        brief || 'Brief unavailable — please review task list manually.',
      generated_at: new Date().toISOString()
    });

  } finally {
    client.release();
  }
});

module.exports = router;
