const express = require('express')
const router  = express.Router()
const db      = require('../../community-db')
const { communityAuth } = require('../../middleware/communityAuth')

// GET /api/community/posts — get feed posts (auth required)
router.get('/', communityAuth, async (req, res) => {
  try {
    const { type, limit = 20, offset = 0 } = req.query

    let query = `
      SELECT
        p.id, p.type, p.body, p.is_pinned, p.is_anonymous,
        p.expires_at, p.is_resolved, p.flag_count,
        p.created_at, p.updated_at,
        CASE WHEN p.is_anonymous = TRUE THEN NULL ELSE p.member_id END AS member_id,
        CASE WHEN p.is_anonymous = TRUE THEN 'Anonymous Member'
             ELSE m.name END AS author_name,
        CASE WHEN p.is_anonymous = TRUE THEN m.role
             ELSE m.role END AS author_role,
        CASE WHEN p.is_anonymous = TRUE THEN m.country
             ELSE m.country END AS author_country,
        CASE WHEN p.is_anonymous = TRUE THEN NULL
             ELSE m.tier END AS author_tier,
        COUNT(DISTINCT c.id) AS comment_count,
        COUNT(DISTINCT s.id) AS save_count
      FROM posts p
      LEFT JOIN members m ON m.id = p.member_id
      LEFT JOIN comments c ON c.post_id = p.id AND c.is_hidden = FALSE
      LEFT JOIN saves s ON s.post_id = p.id
      WHERE p.is_hidden = FALSE
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
    `

    const params = []
    if (type) {
      params.push(type)
      query += ` AND p.type = $${params.length}`
    }

    query += `
      GROUP BY p.id, m.name, m.role, m.country, m.tier
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Posts fetch error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/community/posts — create a post (auth required)
router.post('/', communityAuth, async (req, res) => {
  const { type, body, is_anonymous = false } = req.body
  const member_id = req.communityMember?.id

  if (!member_id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (!type || !body) {
    return res.status(400).json({ error: 'Type and body are required' })
  }

  // Word limits per post type
  const wordLimits = {
    question: { min: 0,   max: 100 },
    article:  { min: 150, max: 600 },
    win:      { min: 100, max: 300 },
    crisis:   { min: 50,  max: 400 },
  }

  if (type !== 'tool' && wordLimits[type]) {
    const wordCount = body.trim().split(/\s+/).length
    const limits = wordLimits[type]
    if (limits.min > 0 && wordCount < limits.min) {
      return res.status(400).json({ error: `Minimum ${limits.min} words required for ${type}` })
    }
    if (wordCount > limits.max) {
      return res.status(400).json({ error: `Maximum ${limits.max} words allowed for ${type}` })
    }
  }

  try {
    // Set expiry for crisis posts (30 days)
    const expires_at = type === 'crisis'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null

    // Set edit lock (30 minutes from now)
    const edit_locked_at = new Date(Date.now() + 30 * 60 * 1000)

    const result = await db.query(
      `INSERT INTO posts (member_id, type, body, is_anonymous, expires_at, edit_locked_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [member_id, type, body, is_anonymous && type === 'crisis', expires_at, edit_locked_at]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Post create error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/community/posts/:id — edit post (within 30 min window)
router.patch('/:id', communityAuth, async (req, res) => {
  const { id } = req.params
  const { body } = req.body
  const member_id = req.communityMember?.id

  try {
    const post = await db.query(
      'SELECT * FROM posts WHERE id = $1',
      [id]
    )

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const p = post.rows[0]

    if (p.member_id !== member_id) {
      return res.status(403).json({ error: 'Not your post' })
    }

    if (new Date(p.edit_locked_at) < new Date()) {
      return res.status(403).json({ error: 'Edit window has closed (30 minutes)' })
    }

    const result = await db.query(
      'UPDATE posts SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [body, id]
    )

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/community/posts/:id/save — save to playbook
router.post('/:id/save', communityAuth, async (req, res) => {
  const { id } = req.params
  const member_id = req.communityMember?.id

  try {
    await db.query(
      `INSERT INTO saves (member_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT (member_id, post_id) DO NOTHING`,
      [member_id, id]
    )

    const count = await db.query(
      'SELECT COUNT(*) FROM saves WHERE post_id = $1',
      [id]
    )

    res.json({ saved: true, save_count: parseInt(count.rows[0].count) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/community/posts/:id/save — unsave
router.delete('/:id/save', communityAuth, async (req, res) => {
  const { id } = req.params
  const member_id = req.communityMember?.id

  try {
    await db.query(
      'DELETE FROM saves WHERE member_id = $1 AND post_id = $2',
      [member_id, id]
    )

    const count = await db.query(
      'SELECT COUNT(*) FROM saves WHERE post_id = $1',
      [id]
    )

    res.json({ saved: false, save_count: parseInt(count.rows[0].count) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/community/posts/:id/flag — flag a post
router.post('/:id/flag', communityAuth, async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const member_id = req.communityMember?.id

  try {
    await db.query(
      `INSERT INTO flags (member_id, target_id, target_type, reason)
       VALUES ($1, $2, 'post', $3)
       ON CONFLICT (member_id, target_id, target_type) DO NOTHING`,
      [member_id, id, reason]
    )

    res.json({ flagged: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/community/posts/:id/comments — get comments
router.get('/:id/comments', communityAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, m.name AS author_name, m.role AS author_role, m.tier AS author_tier
       FROM comments c
       LEFT JOIN members m ON m.id = c.member_id
       WHERE c.post_id = $1 AND c.is_hidden = FALSE
       ORDER BY c.created_at ASC`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/community/posts/:id/comments — add comment
router.post('/:id/comments', communityAuth, async (req, res) => {
  const { body } = req.body
  const member_id = req.communityMember?.id

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment cannot be empty' })
  }

  try {
    const result = await db.query(
      `INSERT INTO comments (post_id, member_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, member_id, body]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/community/posts/:id/resolve — resolve crisis (poster only)
router.patch('/:id/resolve', communityAuth, async (req, res) => {
  const member_id = req.communityMember?.id

  try {
    const result = await db.query(
      `UPDATE posts
       SET is_resolved = TRUE, resolved_at = NOW()
       WHERE id = $1 AND member_id = $2 AND type = 'crisis'
       RETURNING *`,
      [req.params.id, member_id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Crisis post not found or not yours' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router