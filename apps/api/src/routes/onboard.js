const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const PLATFORM_SECRET = process.env.PLATFORM_SECRET || 'platform-secret-change-me';

// Middleware — platform secret header required
function platformAuth(req, res, next) {
  const secret = req.headers['x-platform-secret'];
  if (!secret || secret !== PLATFORM_SECRET)
    return res.status(401).json({ error: 'Invalid platform secret' });
  next();
}

// POST /onboard — create a new tenant + Super User
router.post('/', platformAuth, async (req, res) => {
  const { org_name, admin_name, admin_email, admin_password, apqp_enabled } = req.body;

  if (!org_name || !admin_name || !admin_email || !admin_password)
    return res.status(400).json({ error: 'org_name, admin_name, admin_email, admin_password are required' });
  if (admin_password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check email not already in use
    const existing = await client.query(
      `SELECT user_id FROM users WHERE email = $1`,
      [admin_email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Create tenant - generate subdomain from org name
    const subdomain = org_name.trim().toLowerCase()
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const tenantResult = await client.query(
      `INSERT INTO tenants (company_name, subdomain, apqp_enabled) VALUES ($1, $2, $3) RETURNING tenant_id, company_name, apqp_enabled`,
      [org_name.trim(), subdomain + '-' + Date.now(), apqp_enabled === true || apqp_enabled === 'true']
    );
    const tenant = tenantResult.rows[0];

    // Hash password
    const password_hash = await bcrypt.hash(admin_password, 10);

    // Create Super User
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, full_name, role, is_active, password_hash)
       VALUES ($1, $2, $3, 'super_user', true, $4)
       RETURNING user_id, email, full_name, role`,
      [tenant.tenant_id, admin_email.toLowerCase().trim(), admin_name.trim(), password_hash]
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    res.status(201).json({
      message:   `Tenant "${org_name}" created successfully`,
      tenant_id: tenant.tenant_id,
      org_name:  tenant.company_name,
      super_user: {
        user_id:   user.user_id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role,
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /onboard/tenants — list all tenants (platform admin only)
router.get('/tenants', platformAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT t.tenant_id, t.name, t.created_at,
              COUNT(u.user_id) AS user_count,
              COUNT(p.project_id) AS project_count
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.tenant_id
       LEFT JOIN projects p ON p.tenant_id = t.tenant_id
       GROUP BY t.tenant_id
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } finally {
    client.release();
  }
});

module.exports = router;
