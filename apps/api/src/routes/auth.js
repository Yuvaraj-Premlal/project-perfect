const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const client = await pool.connect();
  try {
    // Look up user by email across all tenants
    const result = await client.query(
      `SELECT u.user_id, u.email, u.full_name, u.role,
              u.password_hash, u.is_active, u.tenant_id,
              t.apqp_enabled
       FROM users u
       JOIN tenants t ON t.tenant_id = u.tenant_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];

    if (!user.is_active)
      return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });

    if (!user.password_hash)
      return res.status(401).json({ error: 'Password not set. Contact your administrator.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    // Sign JWT with correct tenant_id and role
    const token = jwt.sign(
      {
        sub:       user.user_id,
        tenant_id: user.tenant_id,
        role:      user.role,
        email:     user.email,
        name:      user.full_name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        user_id:   user.user_id,
        email:     user.email,
        full_name: user.full_name,
        role:      user.role,
        tenant_id:    user.tenant_id,
        apqp_enabled: user.apqp_enabled,
      }
    });
  } finally {
    client.release();
  }
});

// POST /auth/change-password
router.post('/change-password', async (req, res) => {
  const { email, current_password, new_password } = req.body;
  if (!email || !current_password || !new_password)
    return res.status(400).json({ error: 'All fields are required' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT user_id, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
      [newHash, user.user_id]
    );
    res.json({ success: true });
  } finally {
    client.release();
  }
});

module.exports = router;
