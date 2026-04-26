const jwt = require('jsonwebtoken')
const db  = require('../community-db')

const JWT_SECRET = process.env.COMMUNITY_JWT_SECRET || process.env.JWT_SECRET

async function communityAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const token = authHeader.split(' ')[1]

    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const result = await db.query(
      `SELECT id, name, email, role, company_sector, country,
              tier, status, is_admin, company_name
       FROM members
       WHERE id = $1 AND status = 'active'`,
      [decoded.memberId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Member not found or inactive' })
    }

    req.communityMember = result.rows[0]
    next()

  } catch (err) {
    console.error('Community auth error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

function communityAdmin(req, res, next) {
  if (!req.communityMember?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

module.exports = { communityAuth, communityAdmin }