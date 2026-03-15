const { AzureOpenAI } = require('openai');

const client = new AzureOpenAI({
  apiKey:     process.env.AZURE_OPENAI_KEY,
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-08-01-preview',
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'
});

async function callAI(systemPrompt, userPrompt, maxTokens = 500) {
  try {
    console.log('AI call — key prefix:', process.env.AZURE_OPENAI_KEY?.substring(0, 8));
    const response = await client.chat.completions.create({
      model:    process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens:  maxTokens,
      temperature: 0.3
    });
    console.log('AI call succeeded');
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('AI call failed:', err.status, err.message);
    return null;
  }
}

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

async function generateECDExplanation({ taskName, plannedEndDate, algorithmicEcd, delayDays, slippageCount, cnValue, tcr }) {
  const cnLabel = cnValue === 1 ? 'internal' : cnValue === 10 ? 'supplier-controlled' : 'sub-supplier-controlled';
  const system = `You are a project management assistant explaining delay predictions to a programme manager. Be concise, factual, specific. Avoid jargon. Maximum 3 sentences.`;
  const user = `Explain why this task is predicted to complete on ${algorithmicEcd}:
Task: ${taskName}
Originally planned: ${plannedEndDate}
Current delay: ${delayDays} days
Times slipped previously: ${slippageCount}
Task type: ${cnLabel}
Project external dependency ratio (TCR): ${(tcr * 100).toFixed(0)}%
Explain in plain English in 2-3 sentences.`;
  return await callAI(system, user, 200);
}

async function generateEscalationBrief({ projectName, customerName, opv, lfv, tier, highRiskTasks, totalTasks, ecdAlgorithmic, plannedEndDate }) {
  const system = `You are a project management assistant writing escalation briefs for senior leadership in a manufacturing company. Be factual, concise, action-oriented. No fluff.`;
  const urgency = tier === 1 ? 'requires attention' : 'requires IMMEDIATE leadership intervention';
  const user = `Write a Tier ${tier} escalation brief:
Project: ${projectName}
Customer: ${customerName || 'Customer'}
OPV: ${(opv * 100).toFixed(1)}% (target: above 80%)
LFV: ${(lfv * 100).toFixed(1)}% (target: below 120%)
High risk tasks: ${highRiskTasks} of ${totalTasks}
Planned completion: ${plannedEndDate}
Predicted completion: ${ecdAlgorithmic || 'recalculating'}
This project ${urgency}. Write 3-4 sentences. State problem, impact, action needed.`;
  return await callAI(system, user, 300);
}

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

module.exports = { generateNudgeMessage, generateECDExplanation, generateEscalationBrief, generatePreReviewBrief };
