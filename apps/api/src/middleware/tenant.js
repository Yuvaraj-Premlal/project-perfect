const jwt = require('jsonwebtoken');
const { pool } = require('../db');

// ─────────────────────────────────────────────
// Tenant Middleware
// Runs on every protected route.
// 1. Extracts Bearer token from Authorization header
// 2. Decodes it to get tenant_id and user_id
// 3. Sets app.tenant_id on the DB session for RLS
// 4. Attaches tenant_id and user to req object
// ─────────────────────────────────────────────

async function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Decode without verifying signature for now
    // In Phase 5 we add full Entra External ID verification
    const decoded = jwt.decode(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract tenant_id and user info from token claims
    // Entra External ID puts custom claims in the token
    const tenantId = decoded.tenant_id || decoded['extension_tenant_id'];
    const userId   = decoded.sub || decoded.oid;
    const userRole = decoded.role || decoded['extension_role'] || 'team_member';
    const email    = decoded.email || decoded.preferred_username;

    if (!tenantId) {
      return res.status(401).json({ error: 'Token missing tenant_id claim' });
    }

    // Set tenant context on the DB session for RLS
    // Every query on this request will be scoped to this tenant
    const client = await pool.connect();
    await client.query(`SET app.tenant_id = '${tenantId}'`);
    client.release();

    // Attach to request for use in route handlers
    req.tenantId = tenantId;
    req.userId   = userId;
    req.userRole = userRole;
    req.email    = email;

    next();
  } catch (err) {
    console.error('Tenant middleware error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// ─────────────────────────────────────────────
// Role middleware factory
// Usage: requireRole('pm') or requireRole('owner')
// ─────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
}

module.exports = { tenantMiddleware, requireRole };
