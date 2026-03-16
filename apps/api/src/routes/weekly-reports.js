const router  = require('express').Router({ mergeParams: true });
const { dbQuery } = require('../middleware/db-context');
const { generateWeeklyNarrative } = require('../services/ai');

// ─────────────────────────────────────────────
// POST /api/projects/:projectId/weekly-reports
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { projectId } = req.params;

  const projectResult = await dbQuery(req.tenantId,
    `SELECT p.*, u.full_name as pm_name FROM projects p
     LEFT JOIN users u ON u.user_id = p.pm_user_id
     WHERE p.project_id = $1 AND p.tenant_id = $2`,
    [projectId, req.tenantId]
  );
  if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
  const project = projectResult.rows[0];
  if (project.status === 'closed') return res.status(400).json({ error: 'Project is closed' });

  const tasksResult = await dbQuery(req.tenantId,
    `SELECT * FROM tasks WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, req.tenantId]
  );
  const tasks = tasksResult.rows;
  const highRiskCount = tasks.filter(t => t.risk_label === 'high_risk').length;

  const escalationResult = await dbQuery(req.tenantId,
    `SELECT COUNT(*) FROM escalations
     WHERE project_id = $1 AND tenant_id = $2 AND resolved_at IS NULL`,
    [projectId, req.tenantId]
  );
  const escalationActive = parseInt(escalationResult.rows[0].count) > 0;

  const weekEnding = new Date();
  weekEnding.setDate(weekEnding.getDate() + (7 - weekEnding.getDay()) % 7);
  const weekEndingStr = weekEnding.toISOString().split('T')[0];

  const narrative = await generateWeeklyNarrative({
    projectName:     project.project_name,
    customerName:    project.customer_name,
    opv:             parseFloat(project.opv),
    lfv:             parseFloat(project.lfv),
    vr:              parseFloat(project.vr) || 0,
    momentum:        parseFloat(project.momentum),
    highRiskTasks:   highRiskCount,
    totalTasks:      tasks.length,
    escalationActive,
    weekEnding:      weekEndingStr
  });

  const reportResult = await dbQuery(req.tenantId,
    `INSERT INTO weekly_reports
      (tenant_id, project_id, week_ending, report_content, opv_snapshot, lfv_snapshot,
       vr_snapshot, momentum_snapshot, high_risk_count, total_tasks, escalation_active, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [req.tenantId, projectId, weekEndingStr, narrative,
     project.opv, project.lfv, project.vr || 0, project.momentum,
     highRiskCount, tasks.length, escalationActive, req.userId]
  );

  await dbQuery(req.tenantId,
    `INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
     VALUES ($1, 'weekly_report_generated', 'project', $2, $3, $4)`,
    [req.tenantId, projectId, req.userId, JSON.stringify({ week_ending: weekEndingStr })]
  );

  res.status(201).json(reportResult.rows[0]);
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/weekly-reports
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const result = await dbQuery(req.tenantId,
    `SELECT wr.*, u.full_name as generated_by_name
     FROM weekly_reports wr
     LEFT JOIN users u ON u.user_id = wr.generated_by
     WHERE wr.project_id = $1 AND wr.tenant_id = $2
     ORDER BY wr.week_ending DESC`,
    [projectId, req.tenantId]
  );
  res.json(result.rows);
});

module.exports = router;
