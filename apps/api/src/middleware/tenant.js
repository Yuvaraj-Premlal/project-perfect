const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function tenantMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.decode(token);

    console.log('Decoded token:', JSON.stringify(decoded));

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const tenantId = decoded.tenant_id || decoded['extension_tenant_id'];
    const userId   = decoded.sub || decoded.oid;
    const userRole = decoded.role || decoded['extension_role'] || 'team_member';
    const email    = decoded.email || decoded.preferred_username;

    console.log('tenantId:', tenantId, 'userId:', userId, 'role:', userRole);

    if (!tenantId) {
      return res.status(401).json({ error: 'Token missing tenant_id claim' });
    }

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
