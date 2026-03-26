const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const router = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');

// Helper: derive display name from email
// yuvaraj@testco.com -> Yuvaraj
function nameFromEmail(email) {
  if (!email) return 'Unknown';
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1).replace(/[._-]/g, ' ');
}

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/tasks/:taskId/updates
// List all updates for a task, newest first
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { taskId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(`
      SELECT * FROM task_updates
      WHERE task_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
    `, [taskId, req.tenantId]);
    res.json(result.rows);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// POST /api/projects/:projectId/tasks/:taskId/updates
// Create a new structured update — PM only
// ─────────────────────────────────────────────
router.post('/', [
  body('what_done').notEmpty().withMessage('what_done is required'),
  body('what_pending').notEmpty().withMessage('what_pending is required'),
  body('action_owner').notEmpty().withMessage('action_owner is required'),
  body('action_due_date').isISO8601().withMessage('action_due_date must be a valid date'),
  body('impact_if_not_done').notEmpty().withMessage('impact_if_not_done is required'),
  validate
], requireRole('pm'), async (req, res) => {
  const { projectId, taskId } = req.params;
  const {
    what_done,
    what_pending,
    issue_blocker,
    action_owner,
    action_due_date,
    impact_if_not_done,
    is_completion_update,
    evidence_url,
    evidence_label,
    lessons_went_well,
    lessons_went_wrong,
    lessons_do_differently,
  } = req.body;

  const createdByName = nameFromEmail(req.email);

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);

    // Verify task belongs to this project and tenant
    const taskCheck = await client.query(
      `SELECT task_id FROM tasks WHERE task_id = $1 AND project_id = $2 AND tenant_id = $3`,
      [taskId, projectId, req.tenantId]
    );
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await client.query(`
      INSERT INTO task_updates (
        task_id, project_id, tenant_id,
        what_done, what_pending, issue_blocker,
        action_owner, action_due_date, impact_if_not_done,
        created_by_name, is_completion_update, evidence_url, evidence_label,
        lessons_went_well, lessons_went_wrong, lessons_do_differently
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      taskId, projectId, req.tenantId,
      what_done.trim(),
      what_pending.trim(),
      issue_blocker?.trim() || null,
      action_owner.trim(),
      action_due_date,
      impact_if_not_done.trim(),
      createdByName,
      is_completion_update || false,
      evidence_url || null,
      evidence_label || null,
      lessons_went_well || null,
      lessons_went_wrong || null,
      lessons_do_differently || null,
    ]);

    res.status(201).json(result.rows[0]);
  } finally {
    client.release();
  }
});

module.exports = router;
