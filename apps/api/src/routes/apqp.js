const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');
const { pool } = require('../db');

// ─── APQP TEMPLATES ───────────────────────────────────────────────

// GET /api/apqp/templates
router.get('/templates', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT t.template_id, t.name, t.description, t.created_at,
           u.full_name AS created_by_name,
           COUNT(e.element_id) AS element_count
    FROM apqp_templates t
    LEFT JOIN users u ON u.user_id = t.created_by
    LEFT JOIN apqp_template_elements e ON e.template_id = t.template_id
    WHERE t.tenant_id = $1
    GROUP BY t.template_id, u.full_name
    ORDER BY t.created_at DESC
  `, [req.tenantId]);
  res.json(result.rows);
});

// GET /api/apqp/templates/:id
router.get('/templates/:id', async (req, res) => {
  const { id } = req.params;
  const tmpl = await dbQuery(req.tenantId,
    `SELECT * FROM apqp_templates WHERE template_id = $1 AND tenant_id = $2`,
    [id, req.tenantId]
  );
  if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  const elements = await dbQuery(req.tenantId,
    `SELECT * FROM apqp_template_elements WHERE template_id = $1 ORDER BY sequence_order ASC`,
    [id]
  );
  res.json({ ...tmpl.rows[0], elements: elements.rows });
});

// POST /api/apqp/templates — Portfolio Manager / Super User only
router.post('/templates', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const { name, description, elements } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Template name is required' });
  if (!elements || elements.length === 0) return res.status(400).json({ error: 'At least one element is required' });

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');
    const tmpl = await client.query(
      `INSERT INTO apqp_templates (tenant_id, name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.tenantId, name.trim(), description || null, req.userId]
    );
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el.element_name?.trim()) continue;
      await client.query(
        `INSERT INTO apqp_template_elements (template_id, element_name, planned_days, sequence_order)
         VALUES ($1, $2, $3, $4)`,
        [tmpl.rows[0].template_id, el.element_name.trim(), parseInt(el.planned_days) || 10, i + 1]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ template_id: tmpl.rows[0].template_id, name: tmpl.rows[0].name });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /api/apqp/templates/:id
router.delete('/templates/:id', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const result = await dbQuery(req.tenantId,
    `DELETE FROM apqp_templates WHERE template_id = $1 AND tenant_id = $2 RETURNING template_id`,
    [req.params.id, req.tenantId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true });
});

// ─── PROJECT APQP ELEMENTS ────────────────────────────────────────

// GET /api/apqp/projects/:projectId/elements
router.get('/projects/:projectId/elements', async (req, res) => {
  const { projectId } = req.params;
  const elements = await dbQuery(req.tenantId, `
    SELECT e.*,
           u.full_name AS updated_by_name,
           (
             SELECT json_agg(upd ORDER BY upd.created_at DESC)
             FROM project_apqp_updates upd
             WHERE upd.element_id = e.id
           ) AS updates
    FROM project_apqp_elements e
    LEFT JOIN users u ON u.user_id = (
      SELECT created_by FROM project_apqp_updates
      WHERE element_id = e.id ORDER BY created_at DESC LIMIT 1
    )
    WHERE e.project_id = $1 AND e.tenant_id = $2
    ORDER BY e.sequence_order ASC
  `, [projectId, req.tenantId]);
  res.json(elements.rows);
});

// POST /api/apqp/projects/:projectId/elements/instantiate — create elements from template
router.post('/projects/:projectId/elements/instantiate', requireRole('pm', 'portfolio_manager', 'super_user'), async (req, res) => {
  const { projectId } = req.params;
  const { template_id } = req.body;
  if (!template_id) return res.status(400).json({ error: 'template_id is required' });

  const elements = await dbQuery(req.tenantId,
    `SELECT * FROM apqp_template_elements WHERE template_id = $1 ORDER BY sequence_order ASC`,
    [template_id]
  );
  if (elements.rows.length === 0) return res.status(400).json({ error: 'Template has no elements' });

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');
    // Delete existing elements if re-instantiating
    await client.query(`DELETE FROM project_apqp_elements WHERE project_id = $1`, [projectId]);
    for (const el of elements.rows) {
      await client.query(
        `INSERT INTO project_apqp_elements
          (project_id, tenant_id, template_id, element_name, planned_days, sequence_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, req.tenantId, template_id, el.element_name, el.planned_days, el.sequence_order]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: elements.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /api/apqp/projects/:projectId/elements/:elementId — update element
router.patch('/projects/:projectId/elements/:elementId', requireRole('pm', 'portfolio_manager', 'super_user'), async (req, res) => {
  const { projectId, elementId } = req.params;
  const { start_date, status, doc_reference, update_text } = req.body;

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    // Fetch current element
    const curr = await client.query(
      `SELECT * FROM project_apqp_elements WHERE id = $1 AND project_id = $2`,
      [elementId, projectId]
    );
    if (curr.rows.length === 0) return res.status(404).json({ error: 'Element not found' });
    const el = curr.rows[0];

    // Calculate planned_end_date if start_date provided
    let planned_end_date = el.planned_end_date;
    let newStartDate = start_date || el.start_date;
    if (start_date) {
      const sd = new Date(start_date);
      sd.setDate(sd.getDate() + el.planned_days);
      planned_end_date = sd.toISOString().split('T')[0];
    }

    // Handle completion
    const completed_date = status === 'complete' ? new Date().toISOString().split('T')[0] : el.completed_date;
    if (status === 'complete' && !doc_reference) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Document reference is required to mark element as complete' });
    }

    await client.query(`
      UPDATE project_apqp_elements SET
        start_date       = COALESCE($1, start_date),
        planned_end_date = $2,
        status           = COALESCE($3, status),
        doc_reference    = COALESCE($4, doc_reference),
        completed_date   = $5
      WHERE id = $6
    `, [newStartDate, planned_end_date, status, doc_reference, completed_date, elementId]);

    // Post update if text provided
    if (update_text?.trim()) {
      await client.query(
        `INSERT INTO project_apqp_updates (element_id, project_id, tenant_id, update_text, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [elementId, projectId, req.tenantId, update_text.trim(), req.userId]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
