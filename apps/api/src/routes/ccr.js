const router = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');
const { recalculateProjectMetrics } = require('../services/metrics');

async function generateCCRNumber(client, projectId, tenantId, projectCode, projectName) {
  const prefix = projectCode
    ? projectCode
    : projectName.substring(0, 6).toUpperCase().replace(/\s+/g, '')
  const result = await client.query(
    `SELECT COUNT(*) FROM charter_change_requests WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  )
  const next = parseInt(result.rows[0].count) + 1
  return `${prefix}-CCR-${String(next).padStart(3, '0')}`
}

router.get('/', async (req, res) => {
  const { projectId } = req.params
  const client = await pool.connect()
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`)
    const result = await client.query(
      `SELECT * FROM charter_change_requests WHERE project_id = $1 AND tenant_id = $2 ORDER BY raised_at DESC`,
      [projectId, req.tenantId]
    )
    res.json(result.rows)
  } finally {
    client.release()
  }
})

router.post('/', requireRole('pm'), async (req, res) => {
  const { projectId } = req.params
  const { reason_category, description, change_requested_by, evidence_reference, phase_changes, phases_to_add, phases_to_delete } = req.body

  if (!description || description.trim().length < 50)
    return res.status(400).json({ error: 'Description must be at least 50 characters.' })
  if (!evidence_reference || !evidence_reference.trim())
    return res.status(400).json({ error: 'Evidence reference is required.' })

  const client = await pool.connect()
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`)
    await client.query('BEGIN')

    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    )
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' })
    const project = projectResult.rows[0]

    const phasesResult = await client.query(
      `SELECT * FROM project_phases WHERE project_id = $1 ORDER BY phase_order ASC`,
      [projectId]
    )
    const beforePhases = phasesResult.rows

    if (phases_to_delete && phases_to_delete.length > 0) {
      for (const phaseId of phases_to_delete) {
        const taskCheck = await client.query(
          `SELECT COUNT(*) FROM tasks WHERE phase_id = $1 AND tenant_id = $2`,
          [phaseId, req.tenantId]
        )
        if (parseInt(taskCheck.rows[0].count) > 0) {
          const phase = beforePhases.find(p => p.phase_id === phaseId)
          await client.query('ROLLBACK')
          return res.status(400).json({ error: `Cannot delete phase "${phase?.phase_name || phaseId}" — it has tasks assigned.` })
        }
      }
    }

    const afterPhases = JSON.parse(JSON.stringify(beforePhases))

    if (phase_changes && phase_changes.length > 0) {
      for (const change of phase_changes) {
        await client.query(`
          UPDATE project_phases SET
            start_date        = COALESCE($1, start_date),
            target_date       = COALESCE($2, target_date),
            data_availability = COALESCE($3, data_availability)
          WHERE phase_id = $4 AND project_id = $5 AND tenant_id = $6
        `, [change.start_date || null, change.target_date || null, change.data_availability || null, change.phase_id, projectId, req.tenantId])
        const idx = afterPhases.findIndex(p => p.phase_id === change.phase_id)
        if (idx !== -1) {
          if (change.start_date)        afterPhases[idx].start_date        = change.start_date
          if (change.target_date)       afterPhases[idx].target_date       = change.target_date
          if (change.data_availability) afterPhases[idx].data_availability = change.data_availability
        }
      }
    }

    if (phases_to_delete && phases_to_delete.length > 0) {
      for (const phaseId of phases_to_delete) {
        await client.query(
          `DELETE FROM project_phases WHERE phase_id = $1 AND project_id = $2 AND tenant_id = $3`,
          [phaseId, projectId, req.tenantId]
        )
        const idx = afterPhases.findIndex(p => p.phase_id === phaseId)
        if (idx !== -1) afterPhases.splice(idx, 1)
      }
    }

    if (phases_to_add && phases_to_add.length > 0) {
      const maxOrderResult = await client.query(
        `SELECT MAX(phase_order) AS max FROM project_phases WHERE project_id = $1`, [projectId]
      )
      let nextOrder = (maxOrderResult.rows[0].max || 0) + 1
      for (const phase of phases_to_add) {
        const newPhase = await client.query(`
          INSERT INTO project_phases (project_id, tenant_id, phase_name, phase_order, start_date, target_date, data_availability)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [projectId, req.tenantId, phase.phase_name, nextOrder++, phase.start_date, phase.target_date, phase.data_availability || 'yes'])
        afterPhases.push(newPhase.rows[0])
      }
    }

    const remainingPhases = await client.query(
      `SELECT MAX(target_date) AS max_end, MIN(start_date) AS min_start FROM project_phases WHERE project_id = $1`,
      [projectId]
    )
    if (remainingPhases.rows[0].max_end) {
      await client.query(`
        UPDATE projects SET planned_end_date = $1, start_date = COALESCE($2, start_date)
        WHERE project_id = $3 AND tenant_id = $4
      `, [remainingPhases.rows[0].max_end, remainingPhases.rows[0].min_start, projectId, req.tenantId])
    }

    const ccrNumber = await generateCCRNumber(client, projectId, req.tenantId, project.project_code, project.project_name)

    const changesSnapshot = {
      before:  { phases: beforePhases.map(p => ({ phase_id: p.phase_id, phase_name: p.phase_name, start_date: p.start_date, target_date: p.target_date, data_availability: p.data_availability })) },
      after:   { phases: afterPhases.map(p => ({ phase_id: p.phase_id, phase_name: p.phase_name, start_date: p.start_date, target_date: p.target_date, data_availability: p.data_availability })) },
      summary: { phases_modified: (phase_changes || []).length, phases_added: (phases_to_add || []).length, phases_deleted: (phases_to_delete || []).length }
    }

    const raisedByName = req.email ? req.email.split('@')[0].charAt(0).toUpperCase() + req.email.split('@')[0].slice(1) : 'PM'

    const ccrResult = await client.query(`
      INSERT INTO charter_change_requests
        (project_id, tenant_id, ccr_number, raised_by, raised_by_name, reason_category, description, change_requested_by, evidence_reference, changes_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [projectId, req.tenantId, ccrNumber, req.userId, raisedByName, reason_category, description.trim(), change_requested_by, evidence_reference.trim(), JSON.stringify(changesSnapshot)])

    await client.query('COMMIT')
    await recalculateProjectMetrics(projectId, req.tenantId)
    res.status(201).json(ccrResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

module.exports = router
