const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const router  = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { requireRole } = require('../middleware/tenant');
const { recalculateProjectMetrics, detectAndRecordSlippage } = require('../services/metrics');

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/reviews
// List all reviews for a project
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(`
      SELECT r.*, u.full_name AS conducted_by_name
      FROM reviews r
      LEFT JOIN users u ON u.user_id = r.conducted_by
      WHERE r.project_id = $1
      ORDER BY r.review_date DESC
    `, [projectId]);
    res.json(result.rows);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// POST /api/projects/:projectId/reviews
// Save a review — snapshots metrics, checks escalation
// Access: PM only
// ─────────────────────────────────────────────
router.post("/", [
  body("review_date").isISO8601().withMessage("review_date must be a valid date"),
  body("discussion_points").notEmpty().withMessage("discussion_points is required"),
  validate
], requireRole("pm"), async (req, res) => {
  const { projectId } = req.params;
  const {
    discussion_points, blockers, actions_agreed, review_date,
    attended_by, ai_summary, action_items,
    task_updates: reviewTaskUpdates
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    await client.query('BEGIN');

    // Fetch current project metrics — these get snapshotted
    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0];

    // Fetch previous review OPV for momentum
    const prevReviewResult = await client.query(`
      SELECT opv_snapshot FROM reviews
      WHERE project_id = $1
      ORDER BY review_date DESC LIMIT 1
    `, [projectId]);
    const prevOPV = prevReviewResult.rows.length > 0
      ? parseFloat(prevReviewResult.rows[0].opv_snapshot)
      : 0;

    const currentOPV = parseFloat(project.opv);
    const currentLFV = parseFloat(project.lfv);
    const momentum   = currentOPV - prevOPV;

    // Check if escalation should trigger
    // Tier 1: OPV < 0.8 OR LFV > 1.2
    const escalationTriggered = currentOPV < 0.8 || currentLFV > 1.2;

    // Save the review with locked metric snapshots
    const reviewResult = await client.query(`
      INSERT INTO reviews (
        project_id, tenant_id, review_date,
        discussion_points, blockers, actions_agreed,
        attended_by, ai_summary, action_items,
        opv_snapshot, lfv_snapshot, vr_snapshot, momentum_snapshot,
        escalation_triggered, conducted_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      projectId, req.tenantId,
      review_date || new Date().toISOString().split('T')[0],
      discussion_points || null,
      blockers || null,
      actions_agreed || null,
      attended_by || null,
      ai_summary || null,
      action_items ? JSON.stringify(action_items) : null,
      currentOPV.toFixed(4),
      currentLFV.toFixed(4),
      parseFloat(project.vr).toFixed(4),
      momentum.toFixed(4),
      escalationTriggered,
      req.userId
    ]);

    const review = reviewResult.rows[0];

    // ── Apply ECD updates from review agenda responses ──
    const reviewDateStr = review_date || new Date().toISOString().split('T')[0]
    const reviewDateFmt = new Date(reviewDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const attendedByStr = attended_by || 'PM'

    if (reviewTaskUpdates && Array.isArray(reviewTaskUpdates) && reviewTaskUpdates.length > 0) {
      for (const item of reviewTaskUpdates) {
        if (!item.task_id) continue

        // Fetch current task state
        const taskResult = await client.query(
          `SELECT * FROM tasks WHERE task_id = $1 AND tenant_id = $2`,
          [item.task_id, req.tenantId]
        )
        if (taskResult.rows.length === 0) continue
        const task = taskResult.rows[0]

        // Apply ECD update if provided and different
        if (item.new_ecd && item.new_ecd !== task.current_ecd) {
          await detectAndRecordSlippage(client, task, item.new_ecd, req.userId, req.tenantId)
          await client.query(
            `UPDATE tasks SET current_ecd = $1 WHERE task_id = $2 AND tenant_id = $3`,
            [item.new_ecd, item.task_id, req.tenantId]
          )
        }

        // Auto-post structured task update from review response
        if (item.what_pending || item.what_done) {
          await client.query(`
            INSERT INTO task_updates (
              task_id, project_id, tenant_id,
              what_done, what_pending, issue_blocker,
              action_owner, action_due_date, impact_if_not_done,
              created_by_name
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `, [
            item.task_id, projectId, req.tenantId,
            item.what_done || `ECD reviewed as part of project review on ${reviewDateFmt}. Attended by ${attendedByStr}.`,
            item.what_pending || '',
            item.issue_blocker || null,
            item.action_owner || attendedByStr,
            item.new_ecd || task.current_ecd,
            item.impact_if_not_done || 'ECD slip recorded. Project metrics recalculated.',
            `Review · ${reviewDateFmt}`
          ])
        }
      }

      // Recalculate metrics after all ECD updates applied
      await recalculateProjectMetrics(projectId, req.tenantId)

      // Re-fetch updated metrics for snapshot
      const updatedProject = await client.query(
        `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
        [projectId, req.tenantId]
      )
      if (updatedProject.rows.length > 0) {
        const up = updatedProject.rows[0]
        await client.query(`
          UPDATE reviews SET
            opv_snapshot = $1, lfv_snapshot = $2,
            vr_snapshot = $3, momentum_snapshot = $4
          WHERE review_id = $5
        `, [
          parseFloat(up.opv).toFixed(4),
          parseFloat(up.lfv).toFixed(4),
          parseFloat(up.vr).toFixed(4),
          (parseFloat(up.opv) - parseFloat(prevOPV)).toFixed(4),
          review.review_id
        ])
      }
    }

    // Update project — next review due in 4 days, record last review time
    const nextReviewDue = new Date();
    nextReviewDue.setDate(nextReviewDue.getDate() + 4);

    await client.query(`
      UPDATE projects SET
        last_review_at   = NOW(),
        next_review_due  = $1,
        momentum         = $2
      WHERE project_id = $3
    `, [nextReviewDue.toISOString().split('T')[0], momentum.toFixed(4), projectId]);

    // ── Trigger Tier 1 escalation if needed ──
    let escalation = null;
    if (escalationTriggered) {
      // Check if there is already an unresolved Tier 1 escalation
      const existingEscalation = await client.query(`
        SELECT * FROM escalations
        WHERE project_id = $1 AND tier = 1 AND resolved_at IS NULL
      `, [projectId]);

      if (existingEscalation.rows.length === 0) {
        // Create new Tier 1 escalation
        const brief = generateEscalationBrief(project, currentOPV, currentLFV, 1);

        const escalationResult = await client.query(`
          INSERT INTO escalations (
            project_id, tenant_id, tier,
            trigger_opv, trigger_lfv,
            ai_brief_original
          ) VALUES ($1,$2,$3,$4,$5,$6)
          RETURNING *
        `, [
          projectId, req.tenantId, 1,
          currentOPV.toFixed(4),
          currentLFV.toFixed(4),
          brief
        ]);
        escalation = escalationResult.rows[0];

        console.log(`Tier 1 escalation triggered for project ${projectId} — OPV: ${currentOPV}, LFV: ${currentLFV}`);
      } else {
        // Check if Tier 1 is 7+ days old — trigger Tier 2
        const tier1 = existingEscalation.rows[0];
        const daysSinceTier1 = Math.round(
          (Date.now() - new Date(tier1.triggered_at)) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceTier1 >= 7) {
          const existingTier2 = await client.query(`
            SELECT * FROM escalations
            WHERE project_id = $1 AND tier = 2 AND resolved_at IS NULL
          `, [projectId]);

          if (existingTier2.rows.length === 0) {
            const brief = generateEscalationBrief(project, currentOPV, currentLFV, 2);

            const escalationResult = await client.query(`
              INSERT INTO escalations (
                project_id, tenant_id, tier,
                trigger_opv, trigger_lfv,
                ai_brief_original
              ) VALUES ($1,$2,$3,$4,$5,$6)
              RETURNING *
            `, [
              projectId, req.tenantId, 2,
              currentOPV.toFixed(4),
              currentLFV.toFixed(4),
              brief
            ]);
            escalation = escalationResult.rows[0];

            console.log(`Tier 2 escalation triggered for project ${projectId}`);
          }
        }
      }
    } else {
      // OPV recovered — resolve any open Tier 1 escalation
      await client.query(`
        UPDATE escalations SET
          resolved_at  = NOW(),
          resolution_opv = $1
        WHERE project_id = $2
          AND resolved_at IS NULL
      `, [currentOPV.toFixed(4), projectId]);
    }

    // Audit log
    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
      VALUES ($1, 'review_saved', 'review', $2, $3, $4)
    `, [req.tenantId, review.review_id, req.userId,
        JSON.stringify({ opv: currentOPV, lfv: currentLFV, escalation_triggered: escalationTriggered })]);

    await client.query('COMMIT');

    res.status(201).json({
      review,
      escalation_triggered: escalationTriggered,
      escalation: escalation || null,
      momentum: parseFloat(momentum.toFixed(4))
    });

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/escalations
// List all escalations for a project
// ─────────────────────────────────────────────
router.get('/escalations', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(`
      SELECT * FROM escalations
      WHERE project_id = $1
      ORDER BY triggered_at DESC
    `, [projectId]);
    res.json(result.rows);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// Escalation brief generator
// Placeholder — replaced with real AI in Phase 5
// ─────────────────────────────────────────────
function generateEscalationBrief(project, opv, lfv, tier) {
  const opvPct  = (opv * 100).toFixed(1);
  const lfvPct  = (lfv * 100).toFixed(1);
  const concern = opv < 0.8 ? `OPV at ${opvPct}% (target: 80%)` : `LFV at ${lfvPct}% (target: below 120%)`;

  if (tier === 1) {
    return `Project ${project.project_name} requires your attention. ${concern}. ` +
           `The project is currently tracking behind plan. ` +
           `A review of task progress and resource allocation is recommended urgently.`;
  }

  return `ESCALATION — TIER 2: Project ${project.project_name} has not recovered since the Tier 1 alert raised 7 days ago. ` +
         `${concern}. Immediate leadership intervention is required to bring this programme back on track.`;
}

module.exports = router;
