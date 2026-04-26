const express = require('express')
const router  = express.Router()
const db      = require('../../community-db')
const { communityAuth, communityAdmin } = require('../../middleware/communityAuth')

// GET /community/events — all upcoming events
router.get('/', communityAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*,
        COUNT(DISTINCT r.id) AS rsvp_count,
        EXISTS(
          SELECT 1 FROM event_rsvps r2
          WHERE r2.event_id = e.id AND r2.member_id = $1
        ) AS has_rsvp
       FROM events e
       LEFT JOIN event_rsvps r ON r.event_id = e.id
       WHERE e.scheduled_at > NOW() - INTERVAL '1 day'
       GROUP BY e.id
       ORDER BY e.scheduled_at ASC`,
      [req.communityMember.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Events fetch error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /community/events/:id/rsvp — RSVP to an event
router.post('/:id/rsvp', communityAuth, async (req, res) => {
  const { question } = req.body
  const member_id = req.communityMember.id

  try {
    await db.query(
      `INSERT INTO event_rsvps (event_id, member_id, question)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, member_id) DO NOTHING`,
      [req.params.id, member_id, question]
    )
    res.json({ rsvp: true, message: 'RSVP confirmed. Yuvaraj will send the link personally 24hrs before.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /community/events/:id/rsvp — cancel RSVP
router.delete('/:id/rsvp', communityAuth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM event_rsvps WHERE event_id = $1 AND member_id = $2',
      [req.params.id, req.communityMember.id]
    )
    res.json({ rsvp: false })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /community/events — admin create event
router.post('/', communityAuth, communityAdmin, async (req, res) => {
  const { type, title, description, scheduled_at, duration_mins, max_attendees, is_recorded } = req.body

  try {
    const result = await db.query(
      `INSERT INTO events (type, title, description, scheduled_at, duration_mins, max_attendees, is_recorded)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [type, title, description, scheduled_at, duration_mins || 60, max_attendees, is_recorded || false]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router