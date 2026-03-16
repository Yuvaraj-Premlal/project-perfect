const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');

// GET /api/projects
router.get('/', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT
      p.project_id, p.project_name, p.project_code, p.product_name,
      p.customer_name, p.risk_tier, p.status,
      p.start_date, p.planned_end_date, p.launch_date_target,
      p.opv, p.lfv, p.momentum, p.en_value,
      p.next_review_due, p.last_review_at, p.ecd_algorithmic,
      u.full_name AS pm_name
    FROM projects p
    LEFT JOIN users u ON u.user_id = p.pm_user_id
    WHERE p.tenant_id = $1 AND p.status = 'active'
    ORDER BY p.created_at DESC
  `, [req.tenantId]);
  res.json(result.rows);
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const project = await dbQuery(req.tenantId, `
    SELECT p.*, u.full_name AS pm_name
    FROM projects p
    LEFT JOIN users u ON u.user_id = p.pm_user_id
    WHERE p.project_id = $1 AND p.tenant_id = $2
  `, [id, req.tenantId]);
  if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

  const phases = await dbQuery(req.tenantId, `
    SELECT * FROM project_phases WHERE project_id = $1 ORDER BY phase_order ASC
  `, [id]);

  const team = await dbQuery(req.tenantId, `
    SELECT pt.*, u.full_name FROM project_team pt
    LEFT JOIN users u ON u.user_id = pt.user_id
    WHERE pt.project_id = $1 ORDER BY pt.role ASC
  `, [id]);

  const taskSummary = await dbQuery(req.tenantId, `
    SELECT
      COUNT(*) AS total_tasks,
      COUNT(*) FILTER (WHERE completion_status = 'complete') AS completed_tasks,
      COUNT(*) FILTER (WHERE risk_label = 'high_risk') AS high_risk_tasks
    FROM tasks WHERE project_id = $1 AND tenant_id = $2
  `, [id, req.tenantId]);

  res.json({ ...project.rows[0], phases: phases.rows, team: team.rows, task_summary: taskSummary.rows[0] });
});

// POST /api/projects
router.post("/", [
  body("project_name").notEmpty().withMessage("project_name is required"),
  body("risk_tier").isIn(["high", "medium", "low"]).withMessage("risk_tier must be high, medium, or low"),
  validate
], requireRole("pm"), async (req, res) => {
  const {
    project_name, project_code, product_name,
    customer_name, launch_date_target, risk_tier, phases, team
  } = req.body;

  if (!phases || phases.length === 0)
    return res.status(400).json({ error: 'At least one phase is required' });

  for (const phase of phases) {
    if (!phase.phase_name || !phase.start_date || !phase.target_date)
      return res.status(400).json({ error: 'Each phase requires phase_name, start_date, and target_date' });
    if (new Date(phase.target_date) <= new Date(phase.start_date))
      return res.status(400).json({ error: `Phase "${phase.phase_name}": target_date must be after start_date` });
  }

  const sortedPhases = [...phases].sort((a, b) => a.phase_order - b.phase_order);
  const project_start_date = sortedPhases[0].start_date;
  const project_end_date   = sortedPhases[sortedPhases.length - 1].target_date;

  const enMap = { high: 10, medium: 5, low: 2 };
  const en_value = enMap[risk_tier];
  const charterLockTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const client = await require('../db').pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    const projectResult = await client.query(`
      INSERT INTO projects (
        tenant_id, project_name, project_code, product_name,
        customer_name, pm_user_id,
        start_date, planned_end_date, launch_date_target,
        risk_tier, en_value, charter_locked_at, next_review_due
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      req.tenantId, project_name, project_code || null, product_name || null,
      customer_name || null, req.userId,
      project_start_date, project_end_date, launch_date_target || null,
      risk_tier, en_value, charterLockTime,
      new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
    ]);

    const project = projectResult.rows[0];

    for (const phase of sortedPhases) {
      await client.query(`
        INSERT INTO project_phases (
          project_id, tenant_id, phase_name, phase_order,
          start_date, target_date, data_availability
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        project.project_id, req.tenantId,
        phase.phase_name, phase.phase_order,
        phase.start_date, phase.target_date,
        phase.data_availability || 'yes'
      ]);
    }

    if (team && team.length > 0) {
      for (const member of team) {
        await client.query(`
          INSERT INTO project_team (project_id, tenant_id, role, user_id, user_name, user_email)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [project.project_id, req.tenantId, member.role,
            member.user_id || null, member.user_name || null, member.user_email || null]);
      }
    }

    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
      VALUES ($1,'project_created','project',$2,$3,$4)
    `, [req.tenantId, project.project_id, req.userId,
        JSON.stringify({ project_name, risk_tier, phase_count: phases.length })]);

    await client.query('COMMIT');

    const phasesResult = await dbQuery(req.tenantId,
      `SELECT * FROM project_phases WHERE project_id = $1 ORDER BY phase_order ASC`,
      [project.project_id]);

    res.status(201).json({ ...project, phases: phasesResult.rows });

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/projects/:id/phases — add new phase (never edit existing)
router.post('/:id/phases', requireRole('pm'), async (req, res) => {
  const { id } = req.params;
  const { phase_name, start_date, target_date, data_availability } = req.body;

  if (!phase_name || !start_date || !target_date)
    return res.status(400).json({ error: 'phase_name, start_date, and target_date are required' });
  if (new Date(target_date) <= new Date(start_date))
    return res.status(400).json({ error: 'target_date must be after start_date' });

  const existing = await dbQuery(req.tenantId,
    `SELECT MAX(phase_order) AS max_order FROM project_phases WHERE project_id = $1`, [id]);
  const nextOrder = (existing.rows[0].max_order || 0) + 1;

  const result = await dbQuery(req.tenantId, `
    INSERT INTO project_phases (
      project_id, tenant_id, phase_name, phase_order,
      start_date, target_date, data_availability
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [id, req.tenantId, phase_name, nextOrder, start_date, target_date, data_availability || 'yes']);

  await dbQuery(req.tenantId, `
    UPDATE projects
    SET planned_end_date = GREATEST(planned_end_date, $1)
    WHERE project_id = $2 AND tenant_id = $3
  `, [target_date, id, req.tenantId]);

  await dbQuery(req.tenantId, `
    INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
    VALUES ($1,'phase_added','project',$2,$3,$4)
  `, [req.tenantId, id, req.userId, JSON.stringify({ phase_name, start_date, target_date })]);

  res.status(201).json(result.rows[0]);
});

// POST /api/projects/:projectId/close
router.post('/:projectId/close', async (req, res) => {
  const { projectId } = req.params;
  const { closure_notes, actual_end_date } = req.body;

  const project = await dbQuery(req.tenantId,
    `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`, [projectId, req.tenantId]);
  if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
  const p = project.rows[0];
  if (p.status === 'closed') return res.status(400).json({ error: 'Project already closed' });

  const tasksResult = await dbQuery(req.tenantId,
    `SELECT completion_status FROM tasks WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, req.tenantId]);
  const completedTasks = tasksResult.rows.filter(t => t.completion_status === 'complete').length;

  const slippageResult = await dbQuery(req.tenantId,
    `SELECT COUNT(*) FROM task_slippage_history tsh
     JOIN tasks t ON t.task_id = tsh.task_id
     WHERE t.project_id = $1 AND tsh.tenant_id = $2`, [projectId, req.tenantId]);
  const totalSlippages = parseInt(slippageResult.rows[0].count);

  const actualEnd = actual_end_date || new Date().toISOString().split('T')[0];
  const { generateClosureReport } = require('../services/ai');
  const closureReport = await generateClosureReport({
    projectName: p.project_name, customerName: p.customer_name,
    startDate: p.start_date, plannedEndDate: p.planned_end_date,
    actualEndDate: actualEnd, finalOpv: parseFloat(p.opv),
    finalLfv: parseFloat(p.lfv), totalTasks: tasksResult.rows.length,
    completedTasks, totalSlippages, closureNotes: closure_notes
  });

  const updated = await dbQuery(req.tenantId,
    `UPDATE projects SET status='closed', actual_end_date=$1, closure_notes=$2,
     closure_report=$3, closed_by=$4, closed_at=NOW()
     WHERE project_id=$5 AND tenant_id=$6 RETURNING *`,
    [actualEnd, closure_notes, closureReport, req.userId, projectId, req.tenantId]);

  await dbQuery(req.tenantId,
    `INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
     VALUES ($1,'project_closed','project',$2,$3,$4)`,
    [req.tenantId, projectId, req.userId, JSON.stringify({ actual_end_date: actualEnd, closure_notes })]);

  res.json({
    message: 'Project closed successfully', project_id: projectId,
    actual_end_date: actualEnd, closure_report: closureReport,
    closed_at: updated.rows[0].closed_at
  });
});

// GET /api/projects/:projectId/closure-report
router.get('/:projectId/closure-report', async (req, res) => {
  const { projectId } = req.params;
  const result = await dbQuery(req.tenantId,
    `SELECT project_name, customer_name, start_date, planned_end_date,
     actual_end_date, closure_notes, closure_report, closed_at, status
     FROM projects WHERE project_id=$1 AND tenant_id=$2`, [projectId, req.tenantId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
  if (result.rows[0].status !== 'closed') return res.status(400).json({ error: 'Project is not closed yet' });
  res.json(result.rows[0]);
});

module.exports = router;
