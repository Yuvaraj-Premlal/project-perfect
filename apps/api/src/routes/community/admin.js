const express = require('express')
const router  = express.Router()
const db      = require('../../community-db')
const { communityAuth, communityAdmin } = require('../../middleware/communityAuth')
const crypto  = require('crypto')

// All admin routes require auth + admin
router.use(communityAuth, communityAdmin)

// GET /community/admin/dashboard — community health stats
router.get('/dashboard', async (req, res) => {
  try {
    const [members, posts, crises, playbook, dormant, active] = await Promise.all([
      db.query("SELECT COUNT(*) FROM members WHERE status = 'active'"),
      db.query("SELECT COUNT(*) FROM posts WHERE created_at > NOW() - INTERVAL '7 days' AND is_hidden = FALSE"),
      db.query("SELECT COUNT(*) FROM posts WHERE type = 'crisis' AND is_resolved = FALSE AND expires_at > NOW()"),
      db.query("SELECT COUNT(*) FROM playbook"),
      db.query("SELECT id, name, email, last_login_at FROM members WHERE status = 'active' AND last_login_at < NOW() - INTERVAL '30 days' ORDER BY last_login_at ASC"),
      db.query(`
        SELECT m.id, m.name, m.country,
          COUNT(DISTINCT p.id) + COUNT(DISTINCT c.id) AS interactions
        FROM members m
        LEFT JOIN posts p ON p.member_id = m.id AND p.created_at > NOW() - INTERVAL '7 days'
        LEFT JOIN comments c ON c.member_id = m.id AND c.created_at > NOW() - INTERVAL '7 days'
        WHERE m.status = 'active'
        GROUP BY m.id
        ORDER BY interactions DESC
        LIMIT 5
      `)
    ])

    res.json({
      active_members:  parseInt(members.rows[0].count),
      posts_this_week: parseInt(posts.rows[0].count),
      active_crises:   parseInt(crises.rows[0].count),
      playbook_entries:parseInt(playbook.rows[0].count),
      dormant_members: dormant.rows,
      most_active:     active.rows
    })
  } catch (err) {
    console.error('Dashboard error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /community/admin/tasks — personal activity tracker
router.get('/tasks', async (req, res) => {
  try {
    const { status = 'pending' } = req.query
    const result = await db.query(
      `SELECT t.*, m.name AS member_name, m.email AS member_email
       FROM admin_tasks t
       LEFT JOIN members m ON m.id = t.member_id
       WHERE t.status = $1
         AND (t.snooze_until IS NULL OR t.snooze_until < NOW())
       ORDER BY
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         t.created_at ASC`,
      [status]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /community/admin/tasks/:id — mark done or snooze
router.patch('/tasks/:id', async (req, res) => {
  const { status, snooze_hours } = req.body

  try {
    let query, params

    if (status === 'snoozed' && snooze_hours) {
      query = `UPDATE admin_tasks
               SET status = 'snoozed',
                   snooze_until = NOW() + ($1 || ' hours')::INTERVAL,
                   updated_at = NOW()
               WHERE id = $2 RETURNING *`
      params = [snooze_hours, req.params.id]
    } else if (status === 'done') {
      query = `UPDATE admin_tasks
               SET status = 'done', completed_at = NOW(), updated_at = NOW()
               WHERE id = $1 RETURNING *`
      params = [req.params.id]
    } else {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const result = await db.query(query, params)
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /community/admin/members — full member list with private fields
router.get('/members', async (req, res) => {
  try {
    const { status = 'active' } = req.query
    const result = await db.query(
      `SELECT m.*,
        COUNT(DISTINCT p.id) AS post_count,
        COUNT(DISTINCT s.id) AS saves_received,
        COUNT(DISTINCT c.id) AS crises_helped
       FROM members m
       LEFT JOIN posts p ON p.member_id = m.id AND p.is_hidden = FALSE
       LEFT JOIN saves s ON s.post_id = p.id
       LEFT JOIN comments c ON c.member_id = m.id
       WHERE m.status = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
      [status]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /community/admin/members/:id — update status or tier
router.patch('/members/:id', async (req, res) => {
  const { status, tier } = req.body

  try {
    const updates = []
    const params = []

    if (status) {
      params.push(status)
      updates.push(`status = $${params.length}`)
    }
    if (tier) {
      params.push(tier)
      updates.push(`tier = $${params.length}`)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    params.push(req.params.id)
    const result = await db.query(
      `UPDATE members SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /community/admin/members/:id/invite — generate invite link
router.post('/members/:id/invite', async (req, res) => {
  try {
    const inviteToken = crypto.randomBytes(32).toString('hex')
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const result = await db.query(
      `UPDATE members
       SET invite_token = $1, invite_expires = $2, updated_at = NOW()
       WHERE id = $3 RETURNING name, email`,
      [inviteToken, inviteExpires, req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' })
    }

    const inviteUrl = `${process.env.FRONTEND_URL}/community/setup-password?token=${inviteToken}`

    res.json({
      invite_url: inviteUrl,
      expires_at: inviteExpires,
      member: result.rows[0]
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /community/admin/export/members — CSV export
router.get('/export/members', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT name, email, role, company_name, company_sector, country,
              tier, status, linkedin_url, created_at, last_login_at
       FROM members WHERE status != 'removed'
       ORDER BY created_at DESC`
    )

    const headers = ['name','email','role','company_name','company_sector',
                     'country','tier','status','linkedin_url','created_at','last_login_at']
    const csv = [
      headers.join(','),
      ...result.rows.map(row =>
        headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="pp-community-members.csv"')
    res.send(csv)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router