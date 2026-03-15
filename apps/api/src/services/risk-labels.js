// ─────────────────────────────────────────────
// Risk Label Ranking
// Labels are assigned by RELATIVE ranking within
// each project — not by fixed thresholds.
// Top 3 non-zero RN = High Risk
// Next 3 non-zero RN = Moderate
// Remaining non-zero RN = Monitoring
// Zero delay = On Track
// Complete = Complete
// RN = cn_value x delay_days — NEVER shown to users
// ─────────────────────────────────────────────

function assignRiskLabels(tasks) {
  // Separate complete tasks — they never get risk labels
  const completeTasks  = tasks.filter(t => t.completion_status === 'complete');
  const activeTasks    = tasks.filter(t => t.completion_status !== 'complete');

  // Separate on-track (zero delay) from delayed
  const onTrackTasks   = activeTasks.filter(t => t.delay_days === 0 || !t.delay_days);
  const delayedTasks   = activeTasks.filter(t => t.delay_days > 0);

  // Sort delayed tasks by RN descending (highest risk first)
  const sorted = delayedTasks.sort((a, b) => {
    const rnA = (a.cn_value || 1) * (a.delay_days || 0);
    const rnB = (b.cn_value || 1) * (b.delay_days || 0);
    return rnB - rnA;
  });

  // Assign labels based on rank position
  const labelled = sorted.map((task, index) => {
    let risk_label;
    if (index < 3)      risk_label = 'high_risk';
    else if (index < 6) risk_label = 'moderate';
    else                risk_label = 'monitoring';

    return {
      task_id:     task.task_id,
      risk_label,
      risk_number: (task.cn_value || 1) * (task.delay_days || 0)
    };
  });

  // On track tasks
  const onTrackLabelled = onTrackTasks.map(task => ({
    task_id:     task.task_id,
    risk_label:  'on_track',
    risk_number: 0
  }));

  // Complete tasks
  const completeLabelled = completeTasks.map(task => ({
    task_id:     task.task_id,
    risk_label:  'complete',
    risk_number: 0
  }));

  return [...labelled, ...onTrackLabelled, ...completeLabelled];
}

module.exports = { assignRiskLabels };
