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
  const highRisk = tasks
    .filter(t => t.risk_label === 'high_risk' || t.risk_label === 'moderate')
    .map(t => `${t.task_name} [${t.control_type.replace('_',' ')}, ${t.delay_days} days delayed, RN:${t.risk_number||0}]`)
    .join('\n')
  const stale = tasks.filter(t => t.completion_status !== 'complete' && (!t.last_update_at || (new Date().getTime() - new Date(t.last_update_at).getTime()) > 4*24*60*60*1000))
    .map(t => t.task_name).join(', ')
  const system = `You are a project management assistant preparing a project quick glance for a programme manager.
Generate exactly 5-7 numbered bullet points. Each bullet is one clear, actionable sentence.
Focus ONLY on: high risk items, tasks needing updates, and specific next actions.
Do NOT mention OPV, LFV, VR or any metric numbers. Be direct and specific.
Format: numbered list only, no headings, no preamble.`
  const user = `Project: ${projectName}
High risk / moderate tasks:
${highRisk || 'None'}
Tasks with no update in 4+ days: ${stale || 'None'}
Momentum: ${momentum >= 0 ? 'improving' : 'declining'}
Generate the project quick glance bullets.`
  return await callAI(system, user, 400)
}

// ─────────────────────────────────────────────
// Weekly report narrative
// ─────────────────────────────────────────────
async function generateWeeklyNarrative({ projectName, customerName, opv, lfv, momentum, highRiskTasks, totalTasks, escalationActive, weekEnding, tasks }) {
  const highRiskList = (tasks||[]).filter(t => t.risk_label === 'high_risk')
    .sort((a,b) => (b.risk_number||0)-(a.risk_number||0))
    .slice(0,5)
    .map(t => `- ${t.task_name} [${t.control_type.replace('_',' ')}, ${t.delay_days}d delay, RN:${t.risk_number||0}]`)
    .join('\n')
  const supplierTasks = (tasks||[]).filter(t => t.control_type==='supplier'||t.control_type==='sub_supplier')
  const supplierDelayed = supplierTasks.filter(t => (t.delay_days||0)>0).length
  const internalTasks = (tasks||[]).filter(t => t.control_type==='internal')
  const internalDelayed = internalTasks.filter(t => (t.delay_days||0)>0).length
  const slippedTasks = (tasks||[]).filter(t => (t.slippage_count||0)>0)
    .map(t => `${t.task_name} (+${t.delay_days}d)`).join(', ')
  const system = `You are a project management assistant writing a comprehensive weekly executive report for senior leadership in a manufacturing company.
The report must be structured with these exact section headings:
## Executive Summary
## Schedule Status
## Schedule Slippages
## Supplier Performance
## Escalation Watch
## Recommended Actions
Each section should be 2-4 sentences. Be factual, specific, and professional. Third person. Flowing prose per section, no bullet points within sections.`
  const user = `Generate weekly executive report for week ending ${weekEnding}:
Project: ${projectName} | Customer: ${customerName||'Customer'}
OPV: ${(opv*100).toFixed(1)}% (target >80%) | LFV: ${(lfv*100).toFixed(1)}% (target <120%)
Momentum: ${momentum>0?'improving':momentum<0?'declining':'flat'} | High risk: ${highRiskTasks}/${totalTasks} tasks
Escalation active: ${escalationActive?'YES - CRITICAL':'No'}
Top high risk tasks:
${highRiskList||'None'}
Slipped tasks: ${slippedTasks||'None'}
Supplier performance: ${supplierDelayed}/${supplierTasks.length} external tasks delayed
Internal performance: ${internalDelayed}/${internalTasks.length} internal tasks delayed`
  return await callAI(system, user, 800)
}

async function generateClosureReport({
  projectName, customerName, startDate, plannedEndDate, actualEndDate,
  finalOpv, finalLfv, totalTasks, completedTasks, totalSlippages,
  pmNotes, taskUpdates, tasks
}) {
  const daysVariance   = Math.round((new Date(actualEndDate) - new Date(plannedEndDate)) / (1000 * 60 * 60 * 24));
  const varianceNote   = daysVariance > 0 ? `${daysVariance} days late` : daysVariance < 0 ? `${Math.abs(daysVariance)} days early` : 'on time';
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : 0;

  const supplierTasks  = (tasks||[]).filter(t => t.control_type === 'supplier' || t.control_type === 'sub_supplier');
  const slippedTasks   = (tasks||[]).filter(t => (t.slippage_count||0) > 0)
    .map(t => `${t.task_name} (${t.slippage_count} slips, +${t.delay_days}d)`).join(', ');

  const lessonsContext = (taskUpdates||[])
    .filter(u => u.is_completion_update)
    .map(u => {
      const parts = [];
      if (u.task_name)           parts.push(`Task: ${u.task_name} [${(u.control_type||'').replace('_',' ')}]`);
      if (u.lessons_went_well)   parts.push(`What went right: ${u.lessons_went_well}`);
      if (u.lessons_went_wrong)  parts.push(`What went wrong: ${u.lessons_went_wrong}`);
      if (u.lessons_differently) parts.push(`Do differently: ${u.lessons_differently}`);
      return parts.join('\n');
    }).filter(Boolean).join('\n---\n');

  const eventsContext = (taskUpdates||[])
    .slice(0, 30)
    .map(u => `[${u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : ''}] ${u.task_name}: ${u.update_text || u.completion_notes || ''}`)
    .filter(u => u.trim().length > 20)
    .join('\n');

  const system = `You are a senior project management consultant writing a detailed case study closure report for a manufacturing programme.
This document will be read by future project managers as organisational learning material.
Be specific, insightful, and draw out patterns not just lists of events.
Write in professional third person prose.
You MUST respond with valid JSON only. No markdown fences, no explanation, no preamble outside the JSON.`;

  const pmNotesClean = (pmNotes || '').replace(/"/g, "'");
  const user = `Generate a comprehensive closure case study for this manufacturing project.

PROJECT FACTS:
Project: ${projectName} | Customer: ${customerName || 'Customer'}
Start: ${startDate} | Planned end: ${plannedEndDate} | Actual end: ${actualEndDate} (${varianceNote})
Tasks: ${completedTasks}/${totalTasks} completed (${completionRate}%) | Total slippages: ${totalSlippages}
Supplier/external tasks: ${supplierTasks.length} | Slipped tasks: ${slippedTasks || 'None'}

LESSONS LEARNT FROM TASK COMPLETIONS:
${lessonsContext || 'No task-level lessons recorded'}

KEY EVENTS FROM UPDATE HISTORY:
${eventsContext || 'No update history available'}

PM NOTES:
${pmNotes || 'None provided'}

Return ONLY this JSON structure:
{
  "sections": {
    "project_overview": "<2-3 sentences: what the project was, customer, timeline, delivery outcome>",
    "key_events_timeline": "<narrative of 3-5 most significant events during the project with approximate timing>",
    "what_went_right": "<specific things that worked well - draw patterns from task lessons>",
    "what_went_wrong": "<specific problems and root causes - identify systemic patterns>",
    "stakeholder_performance": "<how supplier sub-supplier and internal teams performed>",
    "recommendations": "<3-5 specific actionable recommendations for future similar projects>",
    "pm_closing_remarks": "${pmNotesClean || 'No additional remarks from PM.'}"
  },
  "tags": ["<3-6 short kebab-case tags e.g. supplier-documentation-delay phase-2-overrun>"]
}`;

  const raw = await callAI(system, user, 2000);
  const clean = (raw || '').replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return {
      sections: {
        project_overview:        raw || 'Report generation failed.',
        key_events_timeline:     '',
        what_went_right:         '',
        what_went_wrong:         '',
        stakeholder_performance: '',
        recommendations:         '',
        pm_closing_remarks:      pmNotes || ''
      },
      tags: []
    };
  }
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
  const highRisk = tasks.filter(t => t.risk_label === 'high_risk' || t.risk_label === 'moderate')
    .map(t => `${t.task_name} [${t.control_type.replace('_',' ')}, ${t.delay_days} days delayed]`)
    .join('\n')
  const stale = tasks.filter(t => t.completion_status !== 'complete' && (!t.last_update_at || (new Date().getTime() - new Date(t.last_update_at).getTime()) > 4*24*60*60*1000))
    .map(t => t.task_name).join(', ')
  const system = `You are a project management assistant preparing a review summary for a programme manager.
Generate exactly 5-7 numbered bullet points. Each bullet is one clear, actionable sentence.
Focus ONLY on: high risk items, tasks needing updates, and specific next actions.
Do NOT mention OPV, LFV, VR or any metric numbers. Be direct and specific.
Format: numbered list only, no headings, no preamble.`
  const user = `Project: ${projectName}
Last review: ${lastReviewDate || 'None'}
High risk / moderate tasks:
${highRisk || 'None'}
Tasks with no update in 4+ days: ${stale || 'None'}
Momentum: ${momentum >= 0 ? 'improving' : 'declining'}
Generate the review summary bullets.`
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
