const { pool } = require('../db');

// ─────────────────────────────────────────────
// Tenant-scoped DB query helper
// Use this in all route handlers instead of
// calling pool.query() directly.
// Automatically sets app.tenant_id on every
// query so RLS policies are always enforced.
// ─────────────────────────────────────────────

async function dbQuery(tenantId, text, params) {
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${tenantId}'`);
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = { dbQuery };
