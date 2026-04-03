const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');

router.use(requireRole('super_user'));

// DEPARTMENTS
router.get('/departments', async (req, res) => {
  const result = await dbQuery(req.tenantId,
    `SELECT d.*, COUNT(u.user_id) AS user_count
     FROM departments d
     LEFT JOIN users u ON u.department_id = d.department_id AND u.tenant_id = d.tenant_id
     WHERE d.tenant_id = $1 GROUP BY d.department_id ORDER BY d.name ASC`,
    [req.tenantId]);
  res.json(result.rows);
});

router.post('/departments', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = await dbQuery(req.tenantId,
    `INSERT INTO departments (tenant_id, name) VALUES ($1, $2) RETURNING *`,
    [req.tenantId, name.trim()]);
  res.status(201).json(result.rows[0]);
});

router.delete('/departments/:id', async (req, res) => {
  const { id } = req.params;
  const inUse = await dbQuery(req.tenantId,
    `SELECT COUNT(*) FROM users WHERE department_id = $1 AND tenant_id = $2`,
    [id, req.tenantId]);
  if (parseInt(inUse.rows[0].count) > 0)
    return res.status(400).json({ error: 'Cannot delete department with existing users' });
  await dbQuery(req.tenantId,
    `DELETE FROM departments WHERE department_id = $1 AND tenant_id = $2`,
    [id, req.tenantId]);
  res.json({ success: true });
});

// USERS
router.get('/users', async (req, res) => {
  const result = await dbQuery(req.tenantId,
    `SELECT u.user_id, u.email, u.full_name, u.role, u.department,
            u.department_id, u.is_active, u.contact_phone, u.created_at,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     WHERE u.tenant_id = $1 ORDER BY u.full_name ASC`,
    [req.tenantId]);
  res.json(result.rows);
});

router.post('/users', async (req, res) => {
  const { email, full_name, role, department_id, contact_phone, password } = req.body;
  if (!email || !full_name || !role)
    return res.status(400).json({ error: 'email, full_name and role are required' });
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password is required and must be at least 8 characters' });
  const validRoles = ['super_user', 'portfolio_manager', 'pm', 'visitor'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const existing = await dbQuery(req.tenantId,
    `SELECT user_id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already in use' });
  const password_hash = await bcrypt.hash(password, 10);
  const result = await dbQuery(req.tenantId,
    `INSERT INTO users (tenant_id, email, full_name, role, department_id, contact_phone, is_active, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7)
     RETURNING user_id, email, full_name, role, department_id, contact_phone, is_active, created_at`,
    [req.tenantId, email.toLowerCase().trim(), full_name.trim(), role,
     department_id || null, contact_phone || null, password_hash]);
  res.status(201).json(result.rows[0]);
});

router.put('/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { full_name, role, department_id, contact_phone, is_active, password } = req.body;
  const validRoles = ['super_user', 'portfolio_manager', 'pm', 'visitor'];
  if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  // Update password if provided
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const password_hash = await bcrypt.hash(password, 10);
    await dbQuery(req.tenantId,
      `UPDATE users SET password_hash = $1 WHERE user_id = $2 AND tenant_id = $3`,
      [password_hash, userId, req.tenantId]);
  }

  const result = await dbQuery(req.tenantId,
    `UPDATE users SET
       full_name     = COALESCE($1, full_name),
       role          = COALESCE($2, role),
       department_id = $3,
       contact_phone = $4,
       is_active     = COALESCE($5, is_active)
     WHERE user_id = $6 AND tenant_id = $7
     RETURNING user_id, email, full_name, role, department_id, contact_phone, is_active`,
    [full_name || null, role || null, department_id || null,
     contact_phone || null, is_active !== undefined ? is_active : null,
     userId, req.tenantId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

router.delete('/users/:userId', async (req, res) => {
  const { userId } = req.params;
  await dbQuery(req.tenantId,
    `UPDATE users SET is_active = false WHERE user_id = $1 AND tenant_id = $2`,
    [userId, req.tenantId]);
  res.json({ success: true });
});

// SUPPLIERS
router.get('/suppliers', async (req, res) => {
  const { type } = req.query;
  const result = await dbQuery(req.tenantId,
    `SELECT * FROM suppliers WHERE tenant_id = $1 ${type ? 'AND supplier_type = $2' : ''} ORDER BY supplier_name ASC`,
    type ? [req.tenantId, type] : [req.tenantId]);
  res.json(result.rows);
});

router.post('/suppliers', async (req, res) => {
  const { supplier_name, supplier_type, contact_name, contact_email, contact_phone } = req.body;
  if (!supplier_name || !supplier_type)
    return res.status(400).json({ error: 'supplier_name and supplier_type are required' });
  if (!['supplier', 'sub_supplier'].includes(supplier_type))
    return res.status(400).json({ error: 'supplier_type must be supplier or sub_supplier' });
  const result = await dbQuery(req.tenantId,
    `INSERT INTO suppliers (tenant_id, supplier_name, supplier_type, contact_name, contact_email, contact_phone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.tenantId, supplier_name.trim(), supplier_type,
     contact_name || null, contact_email || null, contact_phone || null]);
  res.status(201).json(result.rows[0]);
});

router.put('/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const { supplier_name, supplier_type, contact_name, contact_email, contact_phone } = req.body;
  if (supplier_type && !['supplier', 'sub_supplier'].includes(supplier_type))
    return res.status(400).json({ error: 'Invalid supplier_type' });
  const result = await dbQuery(req.tenantId,
    `UPDATE suppliers SET
       supplier_name = COALESCE($1, supplier_name),
       supplier_type = COALESCE($2, supplier_type),
       contact_name  = $3, contact_email = $4, contact_phone = $5
     WHERE supplier_id = $6 AND tenant_id = $7 RETURNING *`,
    [supplier_name || null, supplier_type || null,
     contact_name || null, contact_email || null, contact_phone || null,
     id, req.tenantId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
  res.json(result.rows[0]);
});

router.delete('/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const inUse = await dbQuery(req.tenantId,
    `SELECT COUNT(*) FROM tasks WHERE supplier_id = $1 AND tenant_id = $2`,
    [id, req.tenantId]);
  if (parseInt(inUse.rows[0].count) > 0)
    return res.status(400).json({ error: 'Cannot delete supplier assigned to existing tasks' });
  await dbQuery(req.tenantId,
    `DELETE FROM suppliers WHERE supplier_id = $1 AND tenant_id = $2`,
    [id, req.tenantId]);
  res.json({ success: true });
});

// VISITOR ACCESS
router.get('/visitors/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const result = await dbQuery(req.tenantId,
    `SELECT pv.*, u.full_name, u.email FROM project_visitors pv
     JOIN users u ON u.user_id = pv.user_id
     WHERE pv.project_id = $1 AND pv.tenant_id = $2`,
    [projectId, req.tenantId]);
  res.json(result.rows);
});

router.post('/visitors', async (req, res) => {
  const { project_id, user_id } = req.body;
  if (!project_id || !user_id) return res.status(400).json({ error: 'project_id and user_id required' });
  const result = await dbQuery(req.tenantId,
    `INSERT INTO project_visitors (tenant_id, project_id, user_id, granted_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT (project_id, user_id) DO NOTHING RETURNING *`,
    [req.tenantId, project_id, user_id, req.userId]);
  res.status(201).json(result.rows[0] || { message: 'Already granted' });
});

router.delete('/visitors/:projectId/:userId', async (req, res) => {
  const { projectId, userId } = req.params;
  await dbQuery(req.tenantId,
    `DELETE FROM project_visitors WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [projectId, userId, req.tenantId]);
  res.json({ success: true });
});

module.exports = router;
