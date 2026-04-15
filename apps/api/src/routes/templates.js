const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');

// GET /api/templates — list all templates for tenant
router.get('/', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT t.template_id, t.name, t.description, t.created_at,
           u.full_name AS created_by_name,
           COUNT(DISTINCT tp.phase_id) AS phase_count,
           COUNT(DISTINCT tt.task_id)  AS task_count
    FROM project_templates t
    LEFT JOIN users u          ON u.user_id    = t.created_by
    LEFT JOIN template_phases tp ON tp.template_id = t.template_id
    LEFT JOIN template_tasks tt  ON tt.template_id = t.template_id
    WHERE t.tenant_id = $1
    GROUP BY t.template_id, u.full_name
    ORDER BY t.created_at DESC
  `, [req.tenantId]);
  res.json(result.rows);
});

// GET /api/templates/:id — get full template with phases and tasks
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const tmpl = await dbQuery(req.tenantId,
    `SELECT * FROM project_templates WHERE template_id = $1 AND tenant_id = $2`,
    [id, req.tenantId]
  );
  if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

  const phases = await dbQuery(req.tenantId,
    `SELECT * FROM template_phases WHERE template_id = $1 ORDER BY phase_order ASC`,
    [id]
  );

  const tasks = await dbQuery(req.tenantId,
    `SELECT * FROM template_tasks WHERE template_id = $1`,
    [id]
  );

  res.json({
    ...tmpl.rows[0],
    phases: phases.rows.map(p => ({
      ...p,
      tasks: tasks.rows.filter(t => t.phase_id === p.phase_id)
    }))
  });
});

// POST /api/templates — create template (Portfolio Manager and Super User only)
router.post('/', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const { name, description, phases } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });
  if (!phases || phases.length === 0) return res.status(400).json({ error: 'At least one phase is required' });

  const { pool } = require('../db');
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    // Create template
    const tmplResult = await client.query(
      `INSERT INTO project_templates (tenant_id, name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.tenantId, name.trim(), description || null, req.userId]
    );
    const template = tmplResult.rows[0];

    // Create phases and tasks
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (!phase.phase_name?.trim()) continue;

      const phaseResult = await client.query(
        `INSERT INTO template_phases (template_id, phase_name, phase_order)
         VALUES ($1, $2, $3) RETURNING *`,
        [template.template_id, phase.phase_name.trim(), i + 1]
      );
      const phaseRow = phaseResult.rows[0];

      if (phase.tasks && phase.tasks.length > 0) {
        for (const task of phase.tasks) {
          if (!task.task_name?.trim()) continue;
          const cnMap = { internal: 1, supplier: 10, sub_supplier: 100 };
          const cnValue = cnMap[task.control_type] || 1;
          await client.query(
            `INSERT INTO template_tasks (template_id, phase_id, task_name, acceptance_criteria, control_type, cn_value)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [template.template_id, phaseRow.phase_id,
             task.task_name.trim(),
             task.acceptance_criteria || null,
             task.control_type || 'internal',
             cnValue]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ template_id: template.template_id, name: template.name });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /api/templates/:id — delete template (Portfolio Manager and Super User only)
router.delete('/:id', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const { id } = req.params;
  const result = await dbQuery(req.tenantId,
    `DELETE FROM project_templates WHERE template_id = $1 AND tenant_id = $2 RETURNING template_id`,
    [id, req.tenantId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true });
});

module.exports = router;
