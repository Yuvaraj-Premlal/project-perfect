const { pool } = require('../db');

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
