const jwt  = require('jsonwebtoken')
const db   = require('../community-db')

// Middleware to authenticate community members
// Attaches req.communityMember on success
async function communityAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.COMMUNITY_JWT_SECRET || process.env.JWT_SECRET)

    // Verify session exists and is not expired
    const crypto = require('crypto')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const session = await db.query(
      `SELECT s.*, m.id AS member_id, m.name, m.email, m.role,
              m.company_sector, m.country, m.tier, m.status, m.is_admin
       FROM sessions s
       JOIN members m ON m.id = s.member_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    )

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired — please log in again' })
    }

    const member = session.rows[0]

    // Check member is active
    if (member.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' })
    }

    req.communityMember = member
    next()

  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    console.error('Community auth error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin-only middleware — use after communityAuth
function communityAdmin(req, res, next) {
  if (!req.communityMember?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

module.exports = { communityAuth, communityAdmin }