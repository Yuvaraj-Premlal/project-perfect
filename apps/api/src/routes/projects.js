const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');

// ─────────────────────────────────────────────
// GET /api/projects
// List all active projects for this tenant
// Access: PM + Owner
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT
      p.project_id,
      p.project_name,
      p.project_code,
      p.customer_name,
      p.risk_tier,
      p.status,
      p.start_date,
      p.planned_end_date,
      p.opv,
      p.lfv,
      p.momentum,
      p.next_review_due,
      p.last_review_at,
      p.is_revised,
      p.revision_count,
      u.full_name AS pm_name,
      s.supplier_name AS primary_supplier_name
    FROM projects p
    LEFT JOIN users u     ON u.user_id = p.pm_user_id
    LEFT JOIN suppliers s ON s.supplier_id = p.primary_supplier_id
    WHERE p.tenant_id = $1
      AND p.status = 'active'
    ORDER BY p.created_at DESC
  `, [req.tenantId]);

  res.json(result.rows);
});

// ─────────────────────────────────────────────
// GET /api/projects/:id
// Get single project with phases, team, and task summary
// Access: PM + team members assigned to project
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const project = await dbQuery(req.tenantId, `
    SELECT p.*, u.full_name AS pm_name
    FROM projects p
    LEFT JOIN users u ON u.user_id = p.pm_user_id
    WHERE p.project_id = $1 AND p.tenant_id = $2
  `, [id, req.tenantId]);

  if (project.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const phases = await dbQuery(req.tenantId, `
    SELECT * FROM project_phases
    WHERE project_id = $1
    ORDER BY phase_order ASC
  `, [id]);

  const team = await dbQuery(req.tenantId, `
    SELECT pt.*, u.full_name
    FROM project_team pt
    LEFT JOIN users u ON u.user_id = pt.user_id
    WHERE pt.project_id = $1
    ORDER BY pt.role ASC
  `, [id]);

  const taskSummary = await dbQuery(req.tenantId, `
    SELECT
      COUNT(*)                                          AS total_tasks,
      COUNT(*) FILTER (WHERE completion_status = 'complete')   AS completed_tasks,
      COUNT(*) FILTER (WHERE risk_label = 'high_risk')         AS high_risk_tasks,
      COUNT(*) FILTER (WHERE completion_status = 'pending_approval') AS pending_approval
    FROM tasks
    WHERE project_id = $1 AND tenant_id = $2
  `, [id, req.tenantId]);

  res.json({
    ...project.rows[0],
    phases: phases.rows,
    team: team.rows,
    task_summary: taskSummary.rows[0]
  });
});

// ─────────────────────────────────────────────
// POST /api/projects
// Create a new project with charter, phases, and team
// Access: PM only
// ─────────────────────────────────────────────
router.post('/', requireRole('pm'), async (req, res) => {
  const {
    project_name, project_code, customer_name, customer_ref,
    primary_supplier_id, start_date, planned_end_date,
    launch_date_target, risk_tier,
    phases,   // array: [{ phase_name, phase_order, target_date, target_quantity }]
    team      // array: [{ role, user_id, user_name, user_email }]
  } = req.body;

  // Validate required fields
  if (!project_name || !start_date || !planned_end_date || !risk_tier) {
    return res.status(400).json({
      error: 'project_name, start_date, planned_end_date, and risk_tier are required'
    });
  }

  if (new Date(planned_end_date) <= new Date(start_date)) {
    return res.status(400).json({
      error: 'planned_end_date must be after start_date'
    });
  }

  // Assign EN value from risk tier
  const enMap = { high: 10, moderate: 5, low: 2 };
  const en_value = enMap[risk_tier];

  // Charter locks 24 hours after creation
  const charterLockTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Use a transaction — project + phases + team all or nothing
  const client = await require('../db').pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    // Insert project
    const projectResult = await client.query(`
      INSERT INTO projects (
        tenant_id, project_name, project_code, customer_name, customer_ref,
        primary_supplier_id, pm_user_id, start_date, planned_end_date,
        launch_date_target, risk_tier, en_value, charter_locked_at,
        next_review_due
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      req.tenantId, project_name, project_code, customer_name, customer_ref,
      primary_supplier_id || null, req.userId, start_date, planned_end_date,
      launch_date_target || null, risk_tier, en_value, charterLockTime,
      new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) // first review due in 4 days
    ]);

    const project = projectResult.rows[0];

    // Insert phases
    if (phases && phases.length > 0) {
      for (const phase of phases) {
        await client.query(`
          INSERT INTO project_phases (project_id, tenant_id, phase_name, phase_order, target_date, target_quantity)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [project.project_id, req.tenantId, phase.phase_name, phase.phase_order, phase.target_date, phase.target_quantity || null]);
      }
    }

    // Insert team
    if (team && team.length > 0) {
      for (const member of team) {
        await client.query(`
          INSERT INTO project_team (project_id, tenant_id, role, user_id, user_name, user_email)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [project.project_id, req.tenantId, member.role, member.user_id || null, member.user_name || null, member.user_email || null]);
      }
    }

    // Audit log
    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
      VALUES ($1, 'project_created', 'project', $2, $3, $4)
    `, [req.tenantId, project.project_id, req.userId, JSON.stringify({ project_name, risk_tier })]);

    await client.query('COMMIT');
    res.status(201).json(project);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
