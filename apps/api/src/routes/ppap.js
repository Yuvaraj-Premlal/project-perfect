const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');
const { pool } = require('../db');

// ─── TEMPLATES ────────────────────────────────────────────────────
router.get('/templates', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT t.template_id, t.name, t.description, t.created_at,
           u.full_name AS created_by_name,
           COUNT(e.element_id) AS element_count
    FROM ppap_templates t
    LEFT JOIN users u ON u.user_id = t.created_by
    LEFT JOIN ppap_template_elements e ON e.template_id = t.template_id
    WHERE t.tenant_id = $1
    GROUP BY t.template_id, u.full_name
    ORDER BY t.created_at DESC
  `, [req.tenantId]);
  res.json(result.rows);
});

router.get('/templates/:id', async (req, res) => {
  const tmpl = await dbQuery(req.tenantId,
    `SELECT * FROM ppap_templates WHERE template_id = $1 AND tenant_id = $2`,
    [req.params.id, req.tenantId]
  );
  if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  const elements = await dbQuery(req.tenantId,
    `SELECT * FROM ppap_template_elements WHERE template_id = $1 ORDER BY sequence_order ASC`,
    [req.params.id]
  );
  res.json({ ...tmpl.rows[0], elements: elements.rows });
});

router.post('/templates', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const { name, description, elements } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Template name is required' });
  if (!elements || elements.length === 0) return res.status(400).json({ error: 'At least one element is required' });
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');
    const tmpl = await client.query(
      `INSERT INTO ppap_templates (tenant_id, name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.tenantId, name.trim(), description || null, req.userId]
    );
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el.element_name?.trim()) continue;
      await client.query(
        `INSERT INTO ppap_template_elements (template_id, element_name, planned_days, sequence_order)
         VALUES ($1, $2, $3, $4)`,
        [tmpl.rows[0].template_id, el.element_name.trim(), parseInt(el.planned_days) || 10, i + 1]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ template_id: tmpl.rows[0].template_id, name: tmpl.rows[0].name });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

router.delete('/templates/:id', requireRole('portfolio_manager', 'super_user'), async (req, res) => {
  const result = await dbQuery(req.tenantId,
    `DELETE FROM ppap_templates WHERE template_id = $1 AND tenant_id = $2 RETURNING template_id`,
    [req.params.id, req.tenantId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true });
});

// ─── PROJECT PPAP ELEMENTS ────────────────────────────────────────
router.get('/projects/:projectId/elements', async (req, res) => {
  const { projectId } = req.params;
  const elements = await dbQuery(req.tenantId, `
    SELECT e.*,
           u.full_name AS responsible_name,
           (
             SELECT json_agg(
               json_build_object(
                 'id', upd.id,
                 'update_text', upd.update_text,
                 'created_at', upd.created_at,
                 'created_by_name', u2.full_name
               ) ORDER BY upd.created_at DESC
             )
             FROM project_ppap_updates upd
             LEFT JOIN users u2 ON u2.user_id = upd.created_by
             WHERE upd.element_id = e.id
           ) AS updates
    FROM project_ppap_elements e
    LEFT JOIN users u ON u.user_id = e.responsible_user_id
    WHERE e.project_id = $1 AND e.tenant_id = $2
    ORDER BY e.sequence_order ASC
  `, [projectId, req.tenantId]);
  res.json(elements.rows);
});

router.post('/projects/:projectId/elements/instantiate', requireRole('pm', 'portfolio_manager', 'super_user'), async (req, res) => {
  const { projectId } = req.params;
  const { template_id } = req.body;
  if (!template_id) return res.status(400).json({ error: 'template_id is required' });
  const elements = await dbQuery(req.tenantId,
    `SELECT * FROM ppap_template_elements WHERE template_id = $1 ORDER BY sequence_order ASC`,
    [template_id]
  );
  if (elements.rows.length === 0) return res.status(400).json({ error: 'Template has no elements' });
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');
    await client.query(`DELETE FROM project_ppap_elements WHERE project_id = $1`, [projectId]);
    for (const el of elements.rows) {
      await client.query(
        `INSERT INTO project_ppap_elements
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
  } finally { client.release(); }
});

router.patch('/projects/:projectId/elements/:elementId', requireRole('pm', 'portfolio_manager', 'super_user'), async (req, res) => {
  const { projectId, elementId } = req.params;
  const { start_date, status, doc_reference, update_text, responsible_user_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');
    const curr = await client.query(
      `SELECT * FROM project_ppap_elements WHERE id = $1 AND project_id = $2`,
      [elementId, projectId]
    );
    if (curr.rows.length === 0) return res.status(404).json({ error: 'Element not found' });
    const el = curr.rows[0];

    // Calculate planned_end_date if start_date provided and not already set
    let planned_end_date = el.planned_end_date;
    let newStartDate = el.start_date;
    if (start_date && !el.start_date) {
      newStartDate = start_date;
      const sd = new Date(start_date);
      sd.setDate(sd.getDate() + el.planned_days);
      planned_end_date = sd.toISOString().split('T')[0];
    }

    // Submission logic
    let submission_count = el.submission_count || 0;
    let first_submitted_date = el.first_submitted_date;
    let approved_date = el.approved_date;
    let newStatus = status || el.status;

    if (status === 'submitted') {
      submission_count += 1;
      if (!first_submitted_date) first_submitted_date = new Date().toISOString().split('T')[0];
    }
    if (status === 'approved') {
      approved_date = new Date().toISOString().split('T')[0];
    }
    // Auto-reset to in_progress on rejection
    if (status === 'rejected') {
      newStatus = 'in_progress';
    }

    // Validate doc reference on submission/approval
    if ((status === 'submitted' || status === 'approved') && !doc_reference && !el.doc_reference) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Document reference is required to submit or approve' });
    }

    await client.query(`
      UPDATE project_ppap_elements SET
        start_date           = COALESCE($1, start_date),
        planned_end_date     = $2,
        status               = $3,
        doc_reference        = COALESCE($4, doc_reference),
        submission_count     = $5,
        first_submitted_date = $6,
        approved_date        = $7,
        responsible_user_id  = COALESCE($8, responsible_user_id)
      WHERE id = $9
    `, [newStartDate, planned_end_date, newStatus, doc_reference,
        submission_count, first_submitted_date, approved_date,
        responsible_user_id || null, elementId]);

    // Build update text for history
    let autoText = update_text?.trim() || '';
    if (status === 'submitted') autoText = autoText || `Submitted (submission #${submission_count})`
    if (status === 'approved') autoText = autoText || 'Approved by customer'
    if (status === 'rejected') autoText = autoText || 'Rejected — reset to In Progress'

    if (autoText) {
      await client.query(
        `INSERT INTO project_ppap_updates (element_id, project_id, tenant_id, update_text, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [elementId, projectId, req.tenantId, autoText, req.userId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, new_status: newStatus, submission_count });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
});

module.exports = router;
