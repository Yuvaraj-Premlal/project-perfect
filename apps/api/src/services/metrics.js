const { pool } = require('../db');
const { assignRiskLabels } = require('./risk-labels');

// ─────────────────────────────────────────────
// Main entry point — call after every task save
// Recalculates ALL metrics for a project
// ─────────────────────────────────────────────
async function recalculateProjectMetrics(projectId, tenantId) {
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${tenantId}'`);
    await client.query('BEGIN');

    // ── Fetch project ──
    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    if (projectResult.rows.length === 0) throw new Error('Project not found');
    const project = projectResult.rows[0];

    // ── Fetch all tasks ──
    const tasksResult = await client.query(
      `SELECT * FROM tasks WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    const tasks = tasksResult.rows;

    if (tasks.length === 0) {
      await client.query('COMMIT');
      return;
    }

    // ── Update delay_days and risk_number per task ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const task of tasks) {
      if (task.completion_status === 'complete') {
        // Complete tasks have no delay
        await client.query(
          `UPDATE tasks SET delay_days = 0, risk_number = 0 WHERE task_id = $1`,
          [task.task_id]
        );
        task.delay_days = 0;
        task.risk_number = 0;
      } else {
        const ecd = task.current_ecd
          ? new Date(task.current_ecd)
          : new Date(task.planned_end_date);
        const plannedEnd = new Date(task.planned_end_date);
        const delayDays = Math.max(0, Math.round((ecd - plannedEnd) / (1000 * 60 * 60 * 24)));
        const riskNumber = task.cn_value * delayDays;

        await client.query(
          `UPDATE tasks SET delay_days = $1, risk_number = $2 WHERE task_id = $3`,
          [delayDays, riskNumber, task.task_id]
        );
        task.delay_days  = delayDays;
        task.risk_number = riskNumber;
      }
    }

    // ── Assign risk labels (relative ranking) ──
    const labelledTasks = assignRiskLabels(tasks);
    for (const lt of labelledTasks) {
      await client.query(
        `UPDATE tasks SET risk_label = $1, risk_number = $2 WHERE task_id = $3`,
        [lt.risk_label, lt.risk_number, lt.task_id]
      );
    }

    // ── Calculate OPV ──
    // OPV = (completed / total) / (elapsed / planned_days)
    const totalTasks     = tasks.length;
    const completedTasks = tasks.filter(t => t.completion_status === 'complete').length;

    const startDate   = new Date(project.start_date);
    const endDate     = new Date(project.planned_end_date);
    const elapsedDays = Math.max(0, Math.round((today - startDate) / (1000 * 60 * 60 * 24)));
    const plannedDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

    let opv = 0;
    if (totalTasks > 0 && elapsedDays > 0 && plannedDays > 0) {
      const completionRatio = completedTasks / totalTasks;
      const timeRatio       = elapsedDays / plannedDays;
      opv = completionRatio / timeRatio;
    }

    // ── Calculate LFV ──
    // If past planned end: LFV = 1 / OPV (or 100 if OPV = 0)
    // If within duration: LFV = (incomplete / total) / (remaining / planned)
    const incompleteTasks = totalTasks - completedTasks;
    let lfv = 0;

    if (totalTasks > 0) {
      if (elapsedDays > plannedDays) {
        lfv = opv > 0 ? 1 / opv : 100;
      } else {
        const remainingDays = plannedDays - elapsedDays;
        if (remainingDays > 0 && plannedDays > 0) {
          const incompleteRatio = incompleteTasks / totalTasks;
          const timeRemainingRatio = remainingDays / plannedDays;
          lfv = incompleteRatio / timeRemainingRatio;
        }
      }
    }

    // ── Calculate VR and PR ──
    const vr = lfv > 0 ? opv / lfv : 0;
    const pr = vr * project.en_value;

    // ── Calculate project ECD (algorithmic) ──
    // If OPV > 0: new duration = (1 / OPV) x planned days
    // If OPV = 0: new duration = planned days + elapsed days
    let ecdAlgorithmic = null;
    if (plannedDays > 0) {
      const newDuration = opv > 0
        ? Math.round((1 / opv) * plannedDays)
        : plannedDays + elapsedDays;
      ecdAlgorithmic = new Date(startDate);
      ecdAlgorithmic.setDate(ecdAlgorithmic.getDate() + newDuration);
    }

    // ── Take worst of algorithmic ECD and worst incomplete task ECD ──
    const incompleteTasksWithECD = tasks.filter(t => t.completion_status !== 'complete' && t.current_ecd);
    if (incompleteTasksWithECD.length > 0) {
      const worstTaskECD = new Date(Math.max(...incompleteTasksWithECD.map(t => new Date(t.current_ecd).getTime())));
      if (!ecdAlgorithmic || worstTaskECD > ecdAlgorithmic) {
        ecdAlgorithmic = worstTaskECD;
      }
    }

    // ── Calculate TCR — Task Chaos Ratio ──
    // External tasks (CN=10 + CN=100) / total tasks
    const externalTasks = tasks.filter(t => t.cn_value === 10 || t.cn_value === 100).length;
    const tcr = totalTasks > 0 ? externalTasks / totalTasks : 0;

    // ── Calculate DCR — Duration Chaos Ratio ──
    // Sum of planned days for external tasks / total planned project days
    let externalTaskDays = 0;
    for (const task of tasks) {
      if (task.cn_value === 10 || task.cn_value === 100) {
        if (task.planned_start_date && task.planned_end_date) {
          const taskStart = new Date(task.planned_start_date);
          const taskEnd   = new Date(task.planned_end_date);
          const taskDays  = Math.round((taskEnd - taskStart) / (1000 * 60 * 60 * 24));
          externalTaskDays += Math.max(0, taskDays);
        }
      }
    }
    const dcr = plannedDays > 0 ? externalTaskDays / plannedDays : 0;

    // ── Calculate Momentum ──
    // OPV at current review minus OPV at previous review
    // If no review yet, momentum = 0
    const lastReviewResult = await client.query(
      `SELECT opv_snapshot FROM reviews
       WHERE project_id = $1 ORDER BY review_date DESC LIMIT 1`,
      [projectId]
    );
    const lastReviewOPV = lastReviewResult.rows.length > 0
      ? parseFloat(lastReviewResult.rows[0].opv_snapshot)
      : 0;
    const momentum = opv - lastReviewOPV;

    // ── Update project with all recalculated metrics ──
    await client.query(`
      UPDATE projects SET
        opv              = $1,
        lfv              = $2,
        vr               = $3,
        pr               = $4,
        ecd_algorithmic  = $5,
        tcr              = $6,
        dcr              = $7,
        momentum         = $8
      WHERE project_id   = $9
    `, [
      parseFloat(opv.toFixed(4)),
      parseFloat(lfv.toFixed(4)),
      parseFloat(vr.toFixed(4)),
      parseFloat(pr.toFixed(4)),
      ecdAlgorithmic,
      parseFloat(tcr.toFixed(4)),
      parseFloat(dcr.toFixed(4)),
      parseFloat(momentum.toFixed(4)),
      projectId
    ]);

    // ── Update phase-at-risk flags ──
    const phasesResult = await client.query(
      `SELECT * FROM project_phases WHERE project_id = $1`,
      [projectId]
    );
    for (const phase of phasesResult.rows) {
      const phaseTasks = tasks.filter(t => t.phase_id === phase.phase_id);
      const phaseAtRisk = phaseTasks.some(t => {
        const ecd = t.current_ecd || t.planned_end_date;
        return new Date(ecd) > new Date(phase.target_date) &&
               t.completion_status !== 'complete';
      });
      await client.query(
        `UPDATE project_phases SET is_at_risk = $1 WHERE phase_id = $2`,
        [phaseAtRisk, phase.phase_id]
      );
    }

    // ── Update OPP — median PR across all active projects ──
    const allProjectsResult = await client.query(
      `SELECT pr FROM projects
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY pr ASC`,
      [tenantId]
    );
    const prValues = allProjectsResult.rows.map(r => parseFloat(r.pr));
    const opp = calculateMedian(prValues);

    // ── Update Performance Velocity ──
    const tenantResult = await client.query(
      `SELECT ebitda_current FROM tenants WHERE tenant_id = $1`,
      [tenantId]
    );
    const ebitda = tenantResult.rows[0]?.ebitda_current;
    const performanceVelocity = ebitda && opp > 0
      ? parseFloat(ebitda) / opp
      : null;

    // ── Record daily OPV snapshot (once per day) ──
    await client.query(`
      INSERT INTO daily_opv_snapshots (project_id, tenant_id, snapshot_date, opv, lfv)
      VALUES ($1, $2, CURRENT_DATE, $3, $4)
      ON CONFLICT (project_id, snapshot_date)
      DO UPDATE SET opv = EXCLUDED.opv, lfv = EXCLUDED.lfv
    `, [projectId, tenantId,
        parseFloat(opv.toFixed(4)),
        parseFloat(lfv.toFixed(4))]);

    await client.query('COMMIT');

    console.log(`Metrics recalculated for project ${projectId}:`,
      { opv: opv.toFixed(4), lfv: lfv.toFixed(4), vr: vr.toFixed(4), pr: pr.toFixed(4), tcr: tcr.toFixed(4), dcr: dcr.toFixed(4) }
    );

    return { opv, lfv, vr, pr, ecd_algorithmic: ecdAlgorithmic, tcr, dcr, momentum, opp, performanceVelocity };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Metrics recalculation error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ── Helper: calculate median ──
function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─────────────────────────────────────────────
// Slippage detection
// Call this BEFORE updating the ECD on a task.
// If new ECD is later than current ECD = slippage.
// ─────────────────────────────────────────────
async function detectAndRecordSlippage(client, task, newEcd, changedBy, tenantId) {
  const currentEcd = task.current_ecd
    ? new Date(task.current_ecd)
    : new Date(task.planned_end_date);
  const proposedEcd = new Date(newEcd);

  // Only record if moving backward (later date)
  if (proposedEcd <= currentEcd) return;

  const delayIncrease = Math.round(
    (proposedEcd - currentEcd) / (1000 * 60 * 60 * 24)
  );

  const newSlippageNumber = task.slippage_count + 1;

  await client.query(`
    INSERT INTO task_slippage_history
      (task_id, tenant_id, slippage_number, previous_ecd, new_ecd, delay_increase_days, changed_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    task.task_id,
    tenantId,
    newSlippageNumber,
    currentEcd.toISOString().split('T')[0],
    proposedEcd.toISOString().split('T')[0],
    delayIncrease,
    changedBy
  ]);

  await client.query(
    `UPDATE tasks SET slippage_count = $1 WHERE task_id = $2`,
    [newSlippageNumber, task.task_id]
  );

  console.log(`Slippage #${newSlippageNumber} recorded for task ${task.task_id} — +${delayIncrease} days`);
}

module.exports = { recalculateProjectMetrics, detectAndRecordSlippage };
