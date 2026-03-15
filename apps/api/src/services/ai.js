const https = require('https');

// ─────────────────────────────────────────────
// Direct REST call to Azure OpenAI
// Bypasses SDK — works with both standard and
// Foundry key formats
// ─────────────────────────────────────────────
async function callAI(systemPrompt, userPrompt, maxTokens = 500) {
  return new Promise((resolve) => {
    try {
      const endpoint  = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
      const apiKey    = process.env.AZURE_OPENAI_KEY;
      const apiVersion = '2024-08-01-preview';

      if (!endpoint || !apiKey) {
        console.error('AI: missing endpoint or key');
        return resolve(null);
      }

      const body = JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt }
        ],
        max_tokens:  maxTokens,
        temperature: 0.3
      });

      const url = new URL(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`);

      const options = {
        hostname: url.hostname,
        path:     url.pathname + url.search,
        method:   'POST',
        headers: {
          'Content-Type':  'application/json',
          'api-key':       apiKey,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      console.log('AI REST call to:', url.hostname + url.pathname);

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            console.log('AI response status:', res.statusCode);
            if (res.statusCode !== 200) {
              console.error('AI error body:', data);
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

    } catch (err) {
      console.error('AI call setup error:', err.message);
      resolve(null);
    }
  });
}

async function generateNudgeMessage({ taskName, ownerName, delayDays, plannedEndDate, currentEcd, slippageCount, controlType, projectName, acceptanceCriteria }) {
  const toneGuide = {
    internal:     'professional and direct, written as a colleague',
    supplier:     'firm and commercial, written as a customer to a supplier',
    sub_supplier: 'urgent and escalation-aware, written as a customer whose supply chain is at risk'
  };

  const system = `You are a project management assistant for a manufacturing programme called "${projectName}". Write concise, professional nudge messages. Never be rude. Always be specific about what is needed and by when. Tone: ${toneGuide[controlType] || toneGuide.internal}`;

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

async function generateECDExplanation({ taskName, plannedEndDate, algorithmicEcd, delayDays, slippageCount, cnValue, tcr }) {
  const cnLabel = cnValue === 1 ? 'internal' : cnValue === 10 ? 'supplier-controlled' : 'sub-supplier-controlled';

  const system = `You are a project management assistant explaining delay predictions to a programme manager. Be concise, factual, and specific. Avoid jargon. Maximum 3 sentences.`;

  const user = `Explain why this task is predicted to complete on ${algorithmicEcd}:
Task: ${taskName}
Originally planned: ${plannedEndDate}
Current delay: ${delayDays} days
Times slipped previously: ${slippageCount}
Task type: ${cnLabel}
Project external dependency ratio (TCR): ${(tcr * 100).toFixed(0)}%
Explain the prediction in plain English in 2-3 sentences.`;

  return await callAI(system, user, 200);
}

async function generateEscalationBrief({ projectName, customerName, opv, lfv, tier, highRiskTasks, totalTasks, ecdAlgorithmic, plannedEndDate }) {
  const system = `You are a project management assistant writing escalation briefs for senior leadership in a manufacturing company. Be factual, concise, and action-oriented. No fluff. Maximum 4 sentences.`;

  const urgency = tier === 1 ? 'requires attention' : 'requires IMMEDIATE leadership intervention';

  const user = `Write a Tier ${tier} escalation brief for this project:
Project: ${projectName}
Customer: ${customerName || 'Customer'}
OPV (performance score): ${(opv * 100).toFixed(1)}% (target: above 80%)
LFV (load factor): ${(lfv * 100).toFixed(1)}% (target: below 120%)
High risk tasks: ${highRiskTasks} of ${totalTasks} total tasks
Planned completion: ${plannedEndDate}
Predicted completion: ${ecdAlgorithmic || 'recalculating'}
Urgency: This project ${urgency}.
Write the brief in 3-4 sentences. State the problem, the impact, and what action is needed.`;

  return await callAI(system, user, 300);
}

async function generatePreReviewBrief({ projectName, opv, lfv, momentum, highRiskTasks, tasks }) {
  const system = `You are a project management assistant preparing a pre-review briefing note for a programme manager. Be concise. Highlight what needs attention. Maximum 4 sentences.`;

  const riskySummary = tasks
    .filter(t => t.risk_label === 'high_risk' || t.risk_label === 'moderate')
    .map(t => `${t.task_name} (${t.delay_days} days late, ${t.control_type})`)
    .join(', ');

  const user = `Prepare a pre-review brief for this project:
Project: ${projectName}
OPV: ${(opv * 100).toFixed(1)}%
LFV: ${(lfv * 100).toFixed(1)}%
Momentum (OPV change since last review): ${momentum > 0 ? '+' : ''}${(momentum * 100).toFixed(1)}%
High risk tasks: ${highRiskTasks}
Tasks needing attention: ${riskySummary || 'none'}
Write a 3-4 sentence briefing note the PM should read before starting the review.`;

  return await callAI(system, user, 300);
}

module.exports = {
  generateNudgeMessage,
  generateECDExplanation,
  generateEscalationBrief,
  generatePreReviewBrief
};
