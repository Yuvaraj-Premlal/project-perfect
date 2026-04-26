const express  = require('express')
const router   = express.Router()
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const db       = require('../../community-db')

const JWT_SECRET  = process.env.COMMUNITY_JWT_SECRET || process.env.JWT_SECRET
const JWT_EXPIRES = '7d'

// POST /community/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const result = await db.query(
      'SELECT * FROM members WHERE email = $1 AND status = $2',
      [email.toLowerCase(), 'active']
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const member = result.rows[0]

    if (!member.password_hash) {
      return res.status(401).json({ error: 'Please set your password using the invite link' })
    }

    const valid = await bcrypt.compare(password, member.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Create session
    const token = jwt.sign(
      { memberId: member.id, email: member.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await db.query(
      'INSERT INTO sessions (member_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [member.id, tokenHash, expiresAt]
    )

    // Update last login
    await db.query(
      'UPDATE members SET last_login_at = NOW() WHERE id = $1',
      [member.id]
    )

    // Check if first login
    const isFirstLogin = !member.first_login_at
    if (isFirstLogin) {
      await db.query(
        'UPDATE members SET first_login_at = NOW() WHERE id = $1',
        [member.id]
      )
    }

    res.json({
      token,
      member: {
        id:             member.id,
        name:           member.name,
        role:           member.role,
        company_sector: member.company_sector,
        country:        member.country,
        tier:           member.tier,
        is_admin:       member.is_admin,
        first_login:    isFirstLogin
      }
    })

  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /community/auth/setup-password — called from invite link
router.post('/setup-password', async (req, res) => {
  const { token, password } = req.body

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const result = await db.query(
      'SELECT * FROM members WHERE invite_token = $1 AND invite_expires > NOW()',
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invite link' })
    }

    const member = result.rows[0]
    const passwordHash = await bcrypt.hash(password, 12)

    await db.query(
      `UPDATE members
       SET password_hash = $1, invite_token = NULL,
           invite_expires = NULL, status = 'active', updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, member.id]
    )

    res.json({ message: 'Password set successfully. You can now log in.' })

  } catch (err) {
    console.error('Setup password error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /community/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (authHeader) {
      const token = authHeader.split(' ')[1]
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
    }
    res.json({ message: 'Logged out' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router