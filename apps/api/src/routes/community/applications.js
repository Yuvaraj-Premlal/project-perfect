const express = require('express')
const router  = express.Router()
const db      = require('../../db')

// POST /api/community/apply — public, no auth required
router.post('/apply', async (req, res) => {
  const {
    name, email, role, company_name,
    company_sector, country, linkedin_url, qualifying_answer
  } = req.body

  if (!name || !email || !role || !company_name ||
      !company_sector || !country || !linkedin_url || !qualifying_answer) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    const existing = await db.query(
      'SELECT id, status, reapply_eligible_at FROM applications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [email.toLowerCase()]
    )

    if (existing.rows.length > 0) {
      const app = existing.rows[0]
      if (app.status === 'pending' || app.status === 'hold') {
        return res.status(409).json({ error: 'Application already under review' })
      }
      if (app.status === 'approved') {
        return res.status(409).json({ error: 'Already a member' })
      }
      if (app.status === 'declined' && new Date(app.reapply_eligible_at) > new Date()) {
        return res.status(409).json({
          error: 'Reapplication not yet available',
          reapply_from: app.reapply_eligible_at
        })
      }
    }

    const result = await db.query(
      `INSERT INTO applications
        (name, email, role, company_name, company_sector, country, linkedin_url, qualifying_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [name, email.toLowerCase(), role, company_name,
       company_sector, country, linkedin_url, qualifying_answer]
    )

    res.status(201).json({
      message: 'Application received. You will hear from Yuvaraj within 1-2 weeks.',
      application_id: result.rows[0].id
    })

  } catch (err) {
    console.error('Application error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

// GET /api/community/applications — admin only
router.get('/', async (req, res) => {
  try {
    const { status = 'pending' } = req.query
    const result = await db.query(
      `SELECT * FROM applications
       WHERE status = $1
       ORDER BY created_at ASC`,
      [status]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/community/applications/:id — admin only
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { status, admin_note } = req.body

  try {
    let query, params

    if (status === 'declined') {
      query = `UPDATE applications
               SET status = $1, admin_note = $2,
                   declined_at = NOW(),
                   reapply_eligible_at = NOW() + INTERVAL '3 months',
                   updated_at = NOW()
               WHERE id = $3 RETURNING *`
      params = [status, admin_note, id]
    } else {
      query = `UPDATE applications
               SET status = $1, admin_note = $2, updated_at = NOW()
               WHERE id = $3 RETURNING *`
      params = [status, admin_note, id]
    }

    const result = await db.query(query, params)
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router