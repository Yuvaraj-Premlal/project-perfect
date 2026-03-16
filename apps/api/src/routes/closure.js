const router  = require('express').Router({ mergeParams: true });
const { pool } = require('../db');
const { DefaultAzureCredential } = require('@azure/identity');

async function generateClosureReport({ projectName, customerName, startDate, plannedEndDate, actualEndDate, finalOpv, finalLfv, totalTasks, completedTasks, totalSlippages, closureNotes }) {
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
  const token = tokenResponse.token;

  const system = `You are a project management assistant writing formal project closure reports for manufacturing programmes. Be professional, factual, and constructive. Write in third person.`;

  const daysVariance = Math.round((new Date(actualEndDate) - new Date(plannedEndDate)) / (1000 * 60 * 60 * 24));
  const varianceNote = daysVariance > 0 ? `${daysVariance} days late` : daysVariance < 0 ? `${Math.abs(daysVariance)} days early` : 'on time';
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : 0;

  const user = `Write a project closure report:
Project: ${projectName}
Customer: ${customerName || 'Customer'}
Start date: ${startDate}
Planned completion: ${plannedEndDate}
Actual completion: ${actualEndDate} (${varianceNote})
Final OPV: ${(finalOpv * 100).toFixed(1)}%
Final LFV: ${(finalLfv * 100).toFixed(1)}%
Tasks completed: ${completedTasks} of ${totalTasks} (${completionRate}%)
Total slippages recorded: ${totalSlippages}
PM lessons learned: ${closureNotes || 'None provided'}

Write a 5-6 sentence closure summary covering: delivery outcome, performance summary, key challenges, and one forward-looking recommendation for future similar projects.`;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user }
      ],
      max_tokens:  500,
      temperature: 0.3
    });

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const path = `/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

    const options = {
      hostname: 'project-perfect-ai-india.openai.azure.com',
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = require('https').request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return resolve(null);
          const parsed = JSON.parse(data);
          resolve(parsed.choices?.[0]?.message?.content?.trim() || null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────
// POST /api/projects/:projectId/close
// Formally close a project
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const { closure_notes, actual_end_date } = req.body;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);

    const projectResult = await client.query(
      `SELECT * FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = projectResult.rows[0];
    if (project.status === 'closed') return res.status(400).json({ error: 'Project already closed' });

    const tasksResult = await client.query(
      `SELECT completion_status FROM tasks WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    const completedTasks = tasksResult.rows.filter(t => t.completion_status === 'complete').length;

    const slippageResult = await client.query(
      `SELECT COUNT(*) FROM task_slippage_history 
       WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    const totalSlippages = parseInt(slippageResult.rows[0].count);

    const actualEnd = actual_end_date || new Date().toISOString().split('T')[0];

    const closureReport = await generateClosureReport({
      projectName:    project.project_name,
      customerName:   project.customer_name,
      startDate:      project.start_date,
      plannedEndDate: project.planned_end_date,
      actualEndDate:  actualEnd,
      finalOpv:       parseFloat(project.opv),
      finalLfv:       parseFloat(project.lfv),
      totalTasks:     tasksResult.rows.length,
      completedTasks,
      totalSlippages,
      closureNotes:   closure_notes
    });

    const updatedProject = await client.query(
      `UPDATE projects SET
        status         = 'closed',
        actual_end_date = $1,
        closure_notes  = $2,
        closure_report = $3,
        closed_by      = $4,
        closed_at      = NOW()
       WHERE project_id = $5 AND tenant_id = $6
       RETURNING *`,
      [actualEnd, closure_notes, closureReport, req.userId, projectId, req.tenantId]
    );

    await client.query(`
      INSERT INTO audit_log (tenant_id, event_type, entity_type, entity_id, user_id, new_value)
      VALUES ($1, 'project_closed', 'project', $2, $3, $4)
    `, [req.tenantId, projectId, req.userId,
        JSON.stringify({ actual_end_date: actualEnd, closure_notes })]);

    res.json({
      message:        'Project closed successfully',
      project_id:     projectId,
      actual_end_date: actualEnd,
      closure_report: closureReport,
      closed_at:      updatedProject.rows[0].closed_at
    });

  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:projectId/closure-report
// Get closure report for a closed project
// ─────────────────────────────────────────────
router.get('/closure-report', async (req, res) => {
  const { projectId } = req.params;
  const client = await pool.connect();
  try {
    await client.query(`SET app.tenant_id = '${req.tenantId}'`);
    const result = await client.query(
      `SELECT project_name, customer_name, start_date, planned_end_date,
              actual_end_date, closure_notes, closure_report, closed_at, status
       FROM projects WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = result.rows[0];
    if (project.status !== 'closed') return res.status(400).json({ error: 'Project is not closed yet' });
    res.json(result.rows[0]);
  } finally {
    client.release();
  }
});

module.exports = router;
