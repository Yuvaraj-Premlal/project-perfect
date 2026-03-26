const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const router  = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');
const { recalculateProjectMetrics, detectAndRecordSlippage } = require('../services/metrics');
const multer  = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG and DOCX files are allowed'));
  }
});

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
        lu.what_pending  AS last_update_pending,
        lu.created_at    AS last_update_at
      FROM tasks t
      LEFT JOIN project_phases pp ON pp.phase_id = t.phase_id
      LEFT JOIN suppliers s       ON s.supplier_id = t.supplier_id
      LEFT JOIN LATERAL (
        SELECT what_pending, created_at FROM task_updates
        WHERE task_id = t.task_id ORDER BY created_at DESC LIMIT 1
      ) lu ON true
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


// ─────────────────────────────────────────────
// GET /api/projects/:projectId/tasks/:taskId/updates
// Fetch all updates for a task
// ─────────────────────────────────────────────
router.get('/:taskId/updates', async (req, res) => {
  const { taskId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(`
      SELECT tu.*
      FROM task_updates tu
      WHERE tu.task_id = $1 AND tu.tenant_id = $2
      ORDER BY tu.created_at DESC
    `, [taskId, req.tenantId]);
    res.json(result.rows);
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// POST /api/projects/:projectId/tasks/:taskId/updates
// Create a task update
// ─────────────────────────────────────────────
router.post('/:taskId/updates', requireRole('pm'), async (req, res) => {
  const { projectId, taskId } = req.params;
  const { what_done, what_pending, issue_blocker, action_owner, action_due_date, impact_if_not_done,
          is_completion_update, evidence_url, evidence_label,
          lessons_went_well, lessons_went_wrong, lessons_do_differently } = req.body;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    // Insert the update
    const result = await client.query(`
      INSERT INTO task_updates
        (task_id, project_id, tenant_id, what_done, what_pending, issue_blocker, action_owner, action_due_date, impact_if_not_done, created_by_name, is_completion_update, evidence_url, evidence_label, lessons_went_well, lessons_went_wrong, lessons_do_differently)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [taskId, req.tenantId, what_done, what_pending, issue_blocker || null,
        action_owner, action_due_date || null, impact_if_not_done, req.userId,
        is_completion_update || false, evidence_url || null, evidence_label || null,
        lessons_went_well || null, lessons_went_wrong || null, lessons_do_differently || null]);

    const update = result.rows[0];

    // Write last_update_pending and last_update_at back to tasks row
    await client.query(`
      UPDATE tasks SET
        last_update_pending = $1,
        last_update_at      = $2
      WHERE task_id = $3 AND tenant_id = $4
    `, [what_pending, update.created_at, taskId, req.tenantId]);

    await client.query('COMMIT');

    // Get created_by name
    const userResult = await client.query(
      `SELECT full_name FROM users WHERE user_id = $1`, [req.userId]
    );
    update.created_by_name = userResult.rows[0]?.full_name || '';

    res.json(update);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});


// POST /api/projects/:projectId/tasks/:taskId/evidence-upload
// Upload evidence file to Azure Blob Storage (max 1MB)
router.post('/:taskId/evidence-upload', upload.single('file'), async (req, res) => {
  const { taskId } = req.params;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) return res.status(500).json({ error: 'Storage not configured' });

    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const container   = blobService.getContainerClient('task-evidence');

    const ext      = path.extname(req.file.originalname).toLowerCase();
    const blobName = `${req.tenantId}/${taskId}/${uuidv4()}${ext}`;
    const blob     = container.getBlockBlobClient(blobName);

    await blob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    const url = blob.url;

    // Save to task evidence_url_1
    const client = await pool.connect();
    try {
      await client.query(`SET app.tenant_id = '${req.tenantId}'`);
      await client.query(
        `UPDATE tasks SET evidence_url_1 = $1, evidence_label_1 = $2 WHERE task_id = $3 AND tenant_id = $4`,
        [url, req.file.originalname, taskId, req.tenantId]
      );
    } finally { client.release(); }

    res.json({ url, filename: req.file.originalname });
  } catch (err) {
    if (err.message?.includes('File too large')) return res.status(400).json({ error: 'File exceeds 1MB limit' });
    if (err.message?.includes('Only PDF')) return res.status(400).json({ error: err.message });
    console.error('Evidence upload error:', err);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
});


module.exports = router;
