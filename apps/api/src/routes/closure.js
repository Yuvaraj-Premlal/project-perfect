const router  = require('express').Router({ mergeParams: true });
const { dbQuery } = require('../middleware/db-context');
const { generateClosureReport } = require('../services/ai');

router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const { pm_notes, actual_end_date } = req.body;

  const projectResult = await dbQuery(req.tenantId,
    `SELECT p.*, u.full_name as pm_name
     FROM projects p
     LEFT JOIN users u ON u.user_id = p.pm_user_id
     WHERE p.project_id = $1 AND p.tenant_id = $2`,
    [projectId, req.tenantId]
  );
  if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
  const project = projectResult.rows[0];
  if (project.status === 'closed') return res.status(400).json({ error: 'Project already closed' });

  const tasksResult = await dbQuery(req.tenantId,
    `SELECT t.task_id, t.task_name, t.completion_status, t.control_type,
            t.delay_days, t.slippage_count, t.planned_end_date, t.current_ecd,
            t.risk_number, t.risk_label, t.acceptance_criteria,
            pp.phase_name
     FROM tasks t
     LEFT JOIN project_phases pp ON pp.phase_id = t.phase_id AND pp.tenant_id = t.tenant_id
     WHERE t.project_id = $1 AND t.tenant_id = $2`,
    [projectId, req.tenantId]
  );
  const tasks = tasksResult.rows;

  const incompleteTasks = tasks.filter(t => t.completion_status !== 'complete');
  if (incompleteTasks.length > 0) {
    return res.status(400).json({
      error: 'Cannot close project - incomplete tasks remain',
      incomplete_tasks: incompleteTasks.map(t => ({
        task_id:   t.task_id,
        task_name: t.task_name,
        phase:     t.phase_name || 'Unassigned'
      }))
    });
  }

  const updatesResult = await dbQuery(req.tenantId,
    `SELECT tu.task_id, tu.what_done, tu.what_pending, tu.issue_blocker,
            tu.is_completion_update, tu.lessons_went_well, tu.lessons_went_wrong,
            tu.lessons_do_differently, tu.created_at, tu.created_by_name,
            t.task_name, t.control_type
     FROM task_updates tu
     JOIN tasks t ON t.task_id = tu.task_id
     WHERE t.project_id = $1 AND tu.tenant_id = $2
     ORDER BY tu.created_at ASC`,
    [projectId, req.tenantId]
  );
  const taskUpdates = updatesResult.rows;

  // Correct slippage count — only for this project
  const slippageResult = await dbQuery(req.tenantId,
    `SELECT COUNT(*) FROM task_slippage_history tsh
     JOIN tasks t ON t.task_id = tsh.task_id
     WHERE t.project_id = $1 AND tsh.tenant_id = $2`,
    [projectId, req.tenantId]
  );
  const totalSlippages = parseInt(slippageResult.rows[0].count);

  const completedTasks = tasks.length;
  const actualEnd      = actual_end_date || new Date().toISOString().split('T')[0];
  const daysVariance   = Math.round(
    (new Date(actualEnd) - new Date(project.planned_end_date)) / (1000 * 60 * 60 * 24)
  );

  const aiResult = await generateClosureReport({
    projectName:    project.project_name,
    customerName:   project.customer_name,
    startDate:      project.start_date,
    plannedEndDate: project.planned_end_date,
    actualEndDate:  actualEnd,
    finalOpv:       parseFloat(project.opv) || 0,
    finalLfv:       parseFloat(project.lfv) || 0,
    totalTasks:     tasks.length,
    completedTasks,
    totalSlippages,
    pmNotes:        pm_notes,
    taskUpdates,
    tasks
  });

  const reportResult = await dbQuery(req.tenantId,
    `INSERT INTO closure_reports (
       tenant_id, project_id, pm_notes, sections, tags,
       actual_end_date, planned_end_date, days_variance,
       total_tasks, completed_tasks, total_slippages,
       final_opv, final_lfv, generated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      req.tenantId, projectId,
      pm_notes || null,
      JSON.stringify(aiResult.sections || {}),
      aiResult.tags || [],
      actualEnd,
      project.planned_end_date,
      daysVariance,
      tasks.length,
      completedTasks,
      totalSlippages,
      parseFloat(project.opv) || 0,
      parseFloat(project.lfv) || 0,
      req.userId
    ]
  );

  await dbQuery(req.tenantId,
    `UPDATE projects SET
       status          = 'closed',
       actual_end_date = $1,
       closure_notes   = $2,
       closed_by       = $3,
       closed_at       = NOW()
     WHERE project_id = $4 AND tenant_id = $5`,
    [actualEnd, pm_notes, req.userId, projectId, req.tenantId]
  );

  await dbQuery(req.tenantId,
    `INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
     VALUES ($1, 'project_closed', 'project', $2, $3, $4)`,
    [req.tenantId, projectId, req.userId,
     JSON.stringify({ actual_end_date: actualEnd, days_variance: daysVariance })]
  );

  res.status(201).json(reportResult.rows[0]);
});

router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const result = await dbQuery(req.tenantId,
    `SELECT cr.*, u.full_name as generated_by_name
     FROM closure_reports cr
     LEFT JOIN users u ON u.user_id = cr.generated_by
     WHERE cr.project_id = $1 AND cr.tenant_id = $2`,
    [projectId, req.tenantId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No closure report found' });
  res.json(result.rows[0]);
});

module.exports = router;
