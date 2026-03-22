const https = require('https');
const { DefaultAzureCredential } = require('@azure/identity');

// ─────────────────────────────────────────────
// Single credential instance — reused across
// all AI calls. Token is cached automatically
// by the Azure Identity SDK.
// ─────────────────────────────────────────────
const credential = new DefaultAzureCredential();

const HOSTNAME   = 'project-perfect-ai-india.openai.azure.com';
const API_VERSION = '2024-08-01-preview';

async function callAI(systemPrompt, userPrompt, maxTokens = 500) {
  try {
    const tokenResponse = await credential.getToken('https://cognitiveservices.azure.com/.default');
    const token      = tokenResponse.token;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

    const body = JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens:  maxTokens,
      temperature: 0.3
    });

    return await new Promise((resolve) => {
      const options = {
        hostname: HOSTNAME,
        port:     443,
        path:     `/openai/deployments/${deployment}/chat/completions?api-version=${API_VERSION}`,
        method:   'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error('AI error:', res.statusCode, data);
              return resolve(null);
            }
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content?.trim() || null);
          } catch (e) {
            console.error('AI parse error:', e.message);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.error('AI request error:', e.message);
        resolve(null);
      });

      req.write(body);
      req.end();
    });

  } catch (err) {
    console.error('AI token error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// Nudge message
// ─────────────────────────────────────────────
async function generateNudgeMessage({ taskName, ownerName, delayDays, plannedEndDate, currentEcd, slippageCount, controlType, projectName, acceptanceCriteria }) {
  const toneGuide = {
    internal:     'professional and direct, written as a colleague',
    supplier:     'firm and commercial, written as a customer to a supplier',
    sub_supplier: 'urgent and escalation-aware, written as a customer whose supply chain is at risk'
  };
  const system = `You are a project management assistant for a manufacturing programme called "${projectName}". Write concise, professional nudge messages. Never be rude. Always be specific. Tone: ${toneGuide[controlType] || toneGuide.internal}`;
  const user = `Write a nudge message for this delayed task:
Task: ${taskName}
Owner: ${ownerName || 'Task Owner'}
Original due date: ${plannedEndDate}
Current estimated completion: ${currentEcd}
Days delayed: ${delayDays}
Times slipped: ${slippageCount}
Acceptance criteria: ${acceptanceCriteria}
Write 2-3 sentences maximum. Be specific. Ask for a concrete update or action.`;
  return await callAI(system, user, 200);
}

// ─────────────────────────────────────────────
// ECD explanation
// ─────────────────────────────────────────────
async function generateECDExplanation({ taskName, plannedEndDate, algorithmicEcd, delayDays, slippageCount, cnValue, tcr }) {
  const cnLabel = cnValue === 1 ? 'internal' : cnValue === 10 ? 'supplier-controlled' : 'sub-supplier-controlled';
  const system = `You are a project management assistant explaining delay predictions to a programme manager. Be concise, factual, specific. Avoid jargon. Maximum 3 sentences.`;
  const user = `Explain why this task is predicted to complete on ${algorithmicEcd}:
Task: ${taskName}
Originally planned: ${plannedEndDate}
Current delay: ${delayDays} days
Times slipped previously: ${slippageCount}
Task type: ${cnLabel}
TCR: ${(tcr * 100).toFixed(0)}%
Explain in plain English in 2-3 sentences.`;
  return await callAI(system, user, 200);
}

// ─────────────────────────────────────────────
// Escalation brief
// ─────────────────────────────────────────────
async function generateEscalationBrief({ projectName, customerName, opv, lfv, tier, highRiskTasks, totalTasks, ecdAlgorithmic, plannedEndDate }) {
  const system = `You are a project management assistant writing escalation briefs for senior leadership in a manufacturing company. Be factual, concise, action-oriented.`;
  const urgency = tier === 1 ? 'requires attention' : 'requires IMMEDIATE leadership intervention';
  const user = `Write a Tier ${tier} escalation brief:
Project: ${projectName}
Customer: ${customerName || 'Customer'}
OPV: ${(opv * 100).toFixed(1)}% (target: above 80%)
LFV: ${(lfv * 100).toFixed(1)}% (target: below 120%)
High risk tasks: ${highRiskTasks} of ${totalTasks}
Planned completion: ${plannedEndDate}
Predicted completion: ${ecdAlgorithmic || 'recalculating'}
This project ${urgency}. Write 3-4 sentences.`;
  return await callAI(system, user, 300);
}

// ─────────────────────────────────────────────
// Pre-review brief
// ─────────────────────────────────────────────
async function generatePreReviewBrief({ projectName, opv, lfv, momentum, highRiskTasks, tasks }) {
  const system = `You are a project management assistant preparing a pre-review briefing note for a programme manager. Be concise. Highlight what needs attention.`;
  const riskySummary = tasks
    .filter(t => t.risk_label === 'high_risk' || t.risk_label === 'moderate')
    .map(t => `${t.task_name} (${t.delay_days} days late, ${t.control_type})`)
    .join(', ');
  const user = `Prepare a pre-review brief:
Project: ${projectName}
OPV: ${(opv * 100).toFixed(1)}%
LFV: ${(lfv * 100).toFixed(1)}%
Momentum: ${momentum > 0 ? '+' : ''}${(momentum * 100).toFixed(1)}%
High risk tasks: ${highRiskTasks}
Tasks needing attention: ${riskySummary || 'none'}
Write a 3-4 sentence briefing note.`;
  return await callAI(system, user, 300);
}

// ─────────────────────────────────────────────
// Weekly report narrative
// ─────────────────────────────────────────────
async function generateWeeklyNarrative({ projectName, customerName, opv, lfv, vr, momentum, highRiskTasks, totalTasks, escalationActive, weekEnding }) {
  const system = `You are a project management assistant writing weekly status reports for senior leadership in a manufacturing company. Be factual, concise, and professional. Write in third person. Maximum 5 sentences.`;
  const trend = momentum > 0 ? 'improving' : momentum < 0 ? 'declining' : 'flat';
  const escalationNote = escalationActive ? 'An active escalation is in place.' : 'No active escalations.';
  const user = `Write a weekly status narrative for week ending ${weekEnding}:
Project: ${projectName}
Customer: ${customerName || 'Customer'}
OPV: ${(opv * 100).toFixed(1)}% (target: above 80%)
LFV: ${(lfv * 100).toFixed(1)}%
VR: ${(vr * 100).toFixed(1)}%
Momentum trend: ${trend}
High risk tasks: ${highRiskTasks} of ${totalTasks} total tasks
${escalationNote}
Write 4-5 sentences covering current status, trend, key risks, and recommended focus for next week.`;
  return await callAI(system, user, 400);
}

// ─────────────────────────────────────────────
// Closure report
// ─────────────────────────────────────────────
async function generateClosureReport({ projectName, customerName, startDate, plannedEndDate, actualEndDate, finalOpv, finalLfv, totalTasks, completedTasks, totalSlippages, closureNotes }) {
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
Write a 5-6 sentence closure summary covering: delivery outcome, performance summary, key challenges, and one forward-looking recommendation.`;
  return await callAI(system, user, 500);
}

// ─────────────────────────────────────────────
// Review agenda generator
// Reads tasks + latest task updates to produce
// a structured, prioritised meeting agenda
// ─────────────────────────────────────────────
async function generateReviewAgenda({ projectName, opv, lfv, momentum, tasks, lastReviewDate }) {
  const today = new Date().toISOString().split('T')[0]

  // Build rich task context including latest update
  const taskContext = tasks
    .filter(t => t.completion_status !== 'complete')
    .sort((a, b) => (b.risk_number || 0) - (a.risk_number || 0))
    .map(t => {
      const lastUpdate = t.last_update_pending
        ? `Last update (${t.last_update_at ? new Date(t.last_update_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : 'unknown'}): ${t.last_update_pending}`
        : 'No updates posted yet'
      const ecdOverdue = t.current_ecd && t.current_ecd < today ? ' — OVERDUE' : ''
      return `- ${t.task_name} [${t.control_type}, RN:${t.risk_number || 0}, ${t.slippage_count || 0} slippages, phase: ${t.phase_name || 'unassigned'}, ECD: ${t.current_ecd || 'not set'}${ecdOverdue}]
  ${lastUpdate}`
    }).join('\n')

  const completedSince = lastReviewDate
    ? tasks.filter(t => t.completion_status === 'complete').map(t => t.task_name).join(', ')
    : ''

  const system = `You are a project management AI preparing a structured review agenda for a programme manager in a manufacturing company. 
Your job is to analyse task data and generate a prioritised, time-boxed agenda with specific, context-aware questions for each item.
Respond ONLY with valid JSON. No markdown, no explanation, no preamble.`

  const user = `Generate a review agenda for project: ${projectName}
OPV: ${(opv * 100).toFixed(1)}% | LFV: ${(lfv * 100).toFixed(1)}% | Momentum: ${momentum > 0 ? '+' : ''}${(momentum * 100).toFixed(1)}%
Last review: ${lastReviewDate || 'None'}
Today: ${today}

Active tasks (sorted by risk):
${taskContext}

${completedSince ? `Completed since last review: ${completedSince}` : ''}

Return JSON with this exact structure:
{
  "suggested_duration_minutes": <number>,
  "critical": [
    {
      "task_id": "<uuid or null for phase-level>",
      "task_name": "<name>",
      "reason": "<why this is critical - one sentence>",
      "context": "<key facts: RN, slippages, last update summary>",
      "ai_question": "<specific question referencing actual data from last update>",
      "suggested_minutes": <number>
    }
  ],
  "watch": [
    {
      "task_id": "<uuid or null>",
      "task_name": "<name>",
      "reason": "<why watching>",
      "context": "<key facts>",
      "ai_question": "<specific question>",
      "suggested_minutes": <number>
    }
  ],
  "quick_wins": ["<task name> · completed <date>"]
}`

  const raw = await callAI(system, user, 1000)

  // Strip any markdown fences if model adds them
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    // Fallback if AI returns non-JSON
    return {
      suggested_duration_minutes: 30,
      critical: [],
      watch: [],
      quick_wins: [],
      error: 'Agenda generation failed — please review tasks manually'
    }
  }
}

// ─────────────────────────────────────────────
// Review summary — numbered bullet points
// ─────────────────────────────────────────────
async function generateReviewSummary({ projectName, opv, lfv, momentum, tasks, lastReviewDate }) {
  const today = new Date().toISOString().split('T')[0]

  const activeTasks = tasks.filter(t => t.completion_status !== 'complete')
  const highRisk    = activeTasks.filter(t => t.risk_label === 'high_risk')
  const overdue     = activeTasks.filter(t => t.current_ecd && t.current_ecd < today)
  const completed   = tasks.filter(t => t.completion_status === 'complete')
  const stale       = activeTasks.filter(t => !t.last_update_pending)

  const taskContext = activeTasks
    .sort((a, b) => (b.risk_number || 0) - (a.risk_number || 0))
    .slice(0, 10)
    .map(t => `- ${t.task_name} [RN:${t.risk_number || 0}, ECD:${t.current_ecd || 'not set'}, phase:${t.phase_name || 'unassigned'}, ${t.risk_label}${t.current_ecd && t.current_ecd < today ? ' — OVERDUE' : ''}]${t.last_update_pending ? ` Last update: ${t.last_update_pending}` : ' — no updates'}`)
    .join('\n')

  const system = `You are a project management AI generating a pre-review briefing for a programme manager.
Generate a numbered bullet point summary — concise, factual, actionable.
Each bullet must be one clear sentence. Maximum 8 bullets.
Respond with ONLY the numbered bullets. No headings, no preamble, no markdown.
Example format:
1. Three high-risk tasks in Phase 2 require immediate attention.
2. OPV has improved from last review indicating positive momentum.`

  const user = `Generate a review summary for: ${projectName}
OPV: ${(opv * 100).toFixed(1)}% | LFV: ${(lfv * 100).toFixed(1)}% | Momentum: ${momentum >= 0 ? '+' : ''}${(momentum * 100).toFixed(1)}%
Last review: ${lastReviewDate || 'None'} | Today: ${today}
High risk tasks: ${highRisk.length} | Overdue tasks: ${overdue.length} | Completed: ${completed.length} | No updates: ${stale.length}

Top tasks by risk:
${taskContext}`

  return await callAI(system, user, 400)
}

module.exports = {
  callAI,
  generateNudgeMessage,
  generateECDExplanation,
  generateEscalationBrief,
  generatePreReviewBrief,
  generateWeeklyNarrative,
  generateClosureReport,
  generateReviewAgenda,
  generateReviewSummary
};
