const express = require('express')
const router  = express.Router()
const db      = require('../../community-db')
const { communityAuth } = require('../../middleware/communityAuth')

// GET /community/crisis — active crisis posts
router.get('/', communityAuth, async (req, res) => {
  try {
    const { resolved } = req.query

    const result = await db.query(
      `SELECT
        p.id, p.body, p.is_resolved, p.resolved_at,
        p.expires_at, p.created_at,
        m.role AS author_role, m.country AS author_country,
        COUNT(DISTINCT c.id) AS response_count
       FROM posts p
       JOIN members m ON m.id = p.member_id
       LEFT JOIN comments c ON c.post_id = p.id AND c.is_hidden = FALSE
       WHERE p.type = 'crisis'
         AND p.is_hidden = FALSE
         AND p.expires_at > NOW()
         AND p.is_resolved = $1
       GROUP BY p.id, m.role, m.country
       ORDER BY p.created_at DESC`,
      [resolved === 'true']
    )

    res.json(result.rows)
  } catch (err) {
    console.error('Crisis fetch error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router