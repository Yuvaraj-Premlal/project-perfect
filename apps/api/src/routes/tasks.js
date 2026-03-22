const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const router  = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');
const { recalculateProjectMetrics, detectAndRecordSlippage } = require('../services/metrics');

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/tasks
// List all tasks for a project
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(`
      SELECT
        t.*,
        pp.phase_name,
        s.supplier_name,
        latest_u.what_pending   AS last_update_pending,
        latest_u.created_at     AS last_update_at
      FROM tasks t
      LEFT JOIN project_phases pp ON pp.phase_id = t.phase_id
      LEFT JOIN suppliers s       ON s.supplier_id = t.supplier_id
      LEFT JOIN LATERAL (
        SELECT what_pending, created_at
        FROM task_updates
        WHERE task_id = t.task_id
        ORDER BY created_at DESC
        LIMIT 1
      ) latest_u ON true
      WHERE t.project_id = $1 AND t.tenant_id = $2
      ORDER BY t.risk_number DESC, t.planned_end_date ASC
    `, [projectId, req.tenantId]);

    res.json(result.rows);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// POST /api/projects/:projectId/tasks
// Create a new task
// Access: PM only
// ─────────────────────────────────────────────
router.post("/", [
  body("task_name").notEmpty().withMessage("task_name is required"),
  body("planned_end_date").isISO8601().withMessage("planned_end_date must be a valid date"),
  body("control_type").isIn(["internal","supplier","sub_supplier"]).withMessage("control_type must be internal, supplier, or sub_supplier"),
  body("acceptance_criteria").notEmpty().withMessage("acceptance_criteria is required"),
  validate
], requireRole("pm"), async (req, res) => {
  const { projectId } = req.params;
  const {
    task_name, owner_user_id, owner_email, owner_department,
    phase_id, control_type, cn_value, supplier_id,
    planned_start_date, planned_end_date, acceptance_criteria
  } = req.body;

  // Validate required fields
  if (!task_name || !planned_end_date || !acceptance_criteria || !control_type) {
    return res.status(400).json({
      error: 'task_name, planned_end_date, acceptance_criteria, and control_type are required'
    });
  }

  if (!acceptance_criteria || acceptance_criteria.trim().length < 10) {
    return res.status(400).json({
      error: 'acceptance_criteria must be at least 10 characters'
    });
  }

  // Derive CN value from control type if not provided
  const cnMap = { internal: 1, supplier: 10, sub_supplier: 100 };
  const resolvedCN = cn_value || cnMap[control_type];

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO tasks (
        project_id, tenant_id, task_name,
        owner_user_id, owner_email, owner_department,
        phase_id, control_type, cn_value, supplier_id,
        planned_start_date, planned_end_date,
        acceptance_criteria, current_ecd, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      projectId, req.tenantId, task_name,
      owner_user_id || null, owner_email || null, owner_department || null,
      phase_id || null, control_type, resolvedCN, supplier_id || null,
      planned_start_date || null, planned_end_date,
      acceptance_criteria.trim(), planned_end_date,  // current_ecd starts at planned_end_date
      req.userId
    ]);

    const task = result.rows[0];

    // Audit log
    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
      VALUES ($1, 'task_created', 'task', $2, $3, $4)
    `, [req.tenantId, task.task_id, req.userId,
        JSON.stringify({ task_name, control_type, cn_value: resolvedCN })]);

    await client.query('COMMIT');

    // Recalculate all project metrics
    await recalculateProjectMetrics(projectId, req.tenantId);

    res.status(201).json(task);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// PUT /api/projects/:projectId/tasks/:taskId
// Update task ECD, status, or comments
// Triggers slippage detection + full metrics recalc
// ─────────────────────────────────────────────
router.put('/:taskId', async (req, res) => {
  const { projectId, taskId } = req.params;
  const { current_ecd, completion_status, comments, evidence_url_1, evidence_url_2,
          evidence_label_1, evidence_label_2 } = req.body;

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);

    // Fetch current task state
    const taskResult = await client.query(
      `SELECT * FROM tasks WHERE task_id = $1 AND tenant_id = $2`,
      [taskId, req.tenantId]
    );
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = taskResult.rows[0];

    await client.query('BEGIN');

    // Detect and record slippage BEFORE updating ECD
    if (current_ecd && current_ecd !== task.current_ecd) {
      await detectAndRecordSlippage(client, task, current_ecd, req.userId, req.tenantId);
    }

    // Build update — only update fields that were provided
    const updates = [];
    const values  = [];
    let paramCount = 1;

    if (current_ecd !== undefined) {
      updates.push(`current_ecd = $${paramCount++}`);
      values.push(current_ecd);
    }
    if (completion_status !== undefined) {
      updates.push(`completion_status = $${paramCount++}`);
      values.push(completion_status);
    }
    if (comments !== undefined) {
      updates.push(`comments = $${paramCount++}`);
      values.push(comments);
    }
    if (evidence_url_1 !== undefined) {
      updates.push(`evidence_url_1 = $${paramCount++}`);
      values.push(evidence_url_1);
    }
    if (evidence_url_2 !== undefined) {
      updates.push(`evidence_url_2 = $${paramCount++}`);
      values.push(evidence_url_2);
    }
    if (evidence_label_1 !== undefined) {
      updates.push(`evidence_label_1 = $${paramCount++}`);
      values.push(evidence_label_1);
    }
    if (evidence_label_2 !== undefined) {
      updates.push(`evidence_label_2 = $${paramCount++}`);
      values.push(evidence_label_2);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(taskId, req.tenantId);
    const updateResult = await client.query(`
      UPDATE tasks SET ${updates.join(', ')}
      WHERE task_id = $${paramCount} AND tenant_id = $${paramCount + 1}
      RETURNING *
    `, values);

    // Audit log
    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, old_value, new_value)
      VALUES ($1, 'task_updated', 'task', $2, $3, $4, $5)
    `, [req.tenantId, taskId, req.userId,
        JSON.stringify({ current_ecd: task.current_ecd, completion_status: task.completion_status }),
        JSON.stringify(req.body)]);

    await client.query('COMMIT');

    // Recalculate ALL project metrics — this is the metrics engine firing
    await recalculateProjectMetrics(projectId, req.tenantId);

    res.json(updateResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/tasks/:taskId/slippages
// Get slippage history for a task
// ─────────────────────────────────────────────
router.get('/:taskId/slippages', async (req, res) => {
  const { taskId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(`
      SELECT * FROM task_slippage_history
      WHERE task_id = $1
      ORDER BY slippage_number ASC
    `, [taskId]);
    res.json(result.rows);
  } finally {
    client.release();
  }
});

module.exports = router;
