const express = require('express')
const router  = express.Router()
const db      = require('../../community-db')
const { communityAuth, communityAdmin } = require('../../middleware/communityAuth')

// GET /community/playbook — all members can read
router.get('/', communityAuth, async (req, res) => {
  try {
    const { category, search } = req.query

    let query = `
      SELECT
        pb.id, pb.category, pb.subcategory, pb.curator_note,
        pb.featured_order, pb.added_at,
        p.id AS post_id, p.body, p.type, p.created_at AS post_created_at,
        m.name AS author_name, m.role AS author_role,
        m.company_sector, m.country, m.tier,
        COUNT(DISTINCT s.id) AS save_count
      FROM playbook pb
      JOIN posts p ON p.id = pb.post_id
      JOIN members m ON m.id = p.member_id
      LEFT JOIN saves s ON s.post_id = p.id
      WHERE p.is_hidden = FALSE
    `

    const params = []

    if (category) {
      params.push(category)
      query += ` AND pb.category = $${params.length}`
    }

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (
        p.body ILIKE $${params.length} OR
        pb.curator_note ILIKE $${params.length} OR
        pb.category ILIKE $${params.length}
      )`
    }

    query += `
      GROUP BY pb.id, p.id, m.name, m.role, m.company_sector, m.country, m.tier
      ORDER BY pb.featured_order ASC NULLS LAST, pb.added_at DESC
    `

    const result = await db.query(query, params)
    res.json(result.rows)

  } catch (err) {
    console.error('Playbook fetch error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /community/playbook — admin only
router.post('/', communityAuth, communityAdmin, async (req, res) => {
  const { post_id, category, subcategory, curator_note, featured_order } = req.body
  const added_by = req.communityMember.id

  if (!post_id || !category || !curator_note) {
    return res.status(400).json({ error: 'post_id, category and curator_note are required' })
  }

  try {
    const result = await db.query(
      `INSERT INTO playbook (post_id, category, subcategory, curator_note, featured_order, added_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [post_id, category, subcategory, curator_note, featured_order, added_by]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Playbook add error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /community/playbook/:id — admin only
router.delete('/:id', communityAuth, communityAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM playbook WHERE id = $1', [req.params.id])
    res.json({ message: 'Removed from Playbook' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router