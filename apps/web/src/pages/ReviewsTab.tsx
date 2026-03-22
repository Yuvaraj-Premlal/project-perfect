import React, { useState, useEffect } from 'react'
import { getReviewAgenda, createReviewFull, getReviews } from '../api/projects'

// ─── Types ────────────────────────────────────────────────────────
interface AgendaItem {
  task_id: string | null
  task_name: string
  reason: string
  context: string
  ai_question: string
  suggested_minutes: number
}

interface Agenda {
  suggested_duration_minutes: number
  critical: AgendaItem[]
  watch: AgendaItem[]
  quick_wins: string[]
  error?: string
}

interface AgendaResponse {
  task_id: string | null
  new_ecd: string
  what_done: string
  what_pending: string
  issue_blocker: string
  action_owner: string
  action_due_date: string
  impact_if_not_done: string
}

interface Review {
  review_id: string
  review_date: string
  attended_by: string | null
  discussion_points: string | null
  blockers: string | null
  actions_agreed: string | null
  opv_snapshot: string
  lfv_snapshot: string
  vr_snapshot: string
  momentum_snapshot: string
  conducted_by_name: string | null
  escalation_triggered: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────
function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function monoColor(val: number, good: number, bad: number, higherIsBetter = true): string {
  if (higherIsBetter) return val >= good ? 'var(--green)' : val <= bad ? 'var(--red)' : 'var(--amber)'
  return val <= good ? 'var(--green)' : val >= bad ? 'var(--red)' : 'var(--amber)'
}

function daysDiff(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Agenda Item Component ────────────────────────────────────────
function AgendaItemCard({
  item,
  index,
  priority,
  response,
  onChange,
}: {
  item: AgendaItem
  index: number
  priority: 'critical' | 'watch'
  response: AgendaResponse
  onChange: (field: keyof AgendaResponse, value: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const isResponded = response.what_pending.trim().length > 0

  const dotColor = priority === 'critical' ? 'var(--red)' : 'var(--amber)'

  return (
    <div
      style={{
        border: `1px solid ${isResponded ? '#B3D9C7' : 'var(--border)'}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Item header */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--bg)',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
            {item.task_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {item.reason}
          </div>
        </div>
        {isResponded && (
          <span style={{
            fontSize: 10, fontWeight: 500,
            background: 'var(--green-bg)', color: 'var(--green)',
            padding: '2px 8px', borderRadius: 20, flexShrink: 0,
          }}>
            ✓ Responded
          </span>
        )}
        <span style={{
          fontSize: 11, fontFamily: 'var(--mono)',
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '2px 8px',
          color: 'var(--text3)', flexShrink: 0,
        }}>
          {item.suggested_minutes} min
        </span>
        <svg
          width="13" height="13" viewBox="0 0 16 16" fill="none"
          style={{
            flexShrink: 0, color: 'var(--text3)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {expanded && (
        <>
          {/* Context */}
          <div style={{
            padding: '10px 14px',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text2)' }}>Context: </strong>{item.context}
          </div>

          {/* AI question */}
          <div style={{
            padding: '10px 14px',
            background: 'var(--ai-bg)',
            borderBottom: '1px solid var(--ai-border)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--ai)', marginBottom: 5,
            }}>
              ✦ AI question
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
              {item.ai_question}
            </div>
          </div>

          {/* Response form — same structure as task updates */}
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>
              Response
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                What has been done
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={response.what_done}
                onChange={e => onChange('what_done', e.target.value)}
                placeholder="Progress or actions completed..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                What is yet to be done *
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={response.what_pending}
                onChange={e => onChange('what_pending', e.target.value)}
                placeholder="What was decided / what needs to happen next..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                Issue / blocker
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={response.issue_blocker}
                onChange={e => onChange('issue_blocker', e.target.value)}
                placeholder="Any blockers or risks raised? (optional)"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                  Action owner *
                </label>
                <input
                  className="form-input"
                  value={response.action_owner}
                  onChange={e => onChange('action_owner', e.target.value)}
                  placeholder="Who owns the next step?"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                  Action due by *
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={response.action_due_date}
                  onChange={e => onChange('action_due_date', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                Impact if not done *
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={response.impact_if_not_done}
                onChange={e => onChange('impact_if_not_done', e.target.value)}
                placeholder="What happens if this action is missed?"
              />
            </div>

            {/* ECD update — only for task items */}
            {item.task_id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                  Update ECD (if changed in this review)
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={response.new_ecd}
                  onChange={e => onChange('new_ecd', e.target.value)}
                  style={{ maxWidth: 180 }}
                />
                {response.new_ecd && (
                  <div style={{ fontSize: 11, color: 'var(--amber)' }}>
                    ⚠ ECD change will be applied to the task and recorded as a slippage if later than current ECD
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Review History ───────────────────────────────────────────────
function ReviewHistory({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Review history</div>
          <div className="card-sub">OPV · LFV · VR snapshotted at each review</div>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ padding: '10px 14px' }}>Date</th>
            <th>Attended by</th>
            <th>OPV</th>
            <th>LFV</th>
            <th>VR</th>
            <th>Momentum</th>
            <th>Escalation</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r: Review) => {
            const opv = parseFloat(r.opv_snapshot)
            const lfv = parseFloat(r.lfv_snapshot || '1')
            const vr  = parseFloat(r.vr_snapshot || '0')
            const mom = parseFloat(r.momentum_snapshot || '0')
            return (
              <tr key={r.review_id}>
                <td className="mono" style={{ fontSize: 11 }}>
                  {fmt(r.review_date)}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 160 }}>
                  {r.attended_by || r.conducted_by_name || '—'}
                </td>
                <td>
                  <span className="mono" style={{ color: monoColor(opv, 1.0, 0.8), fontWeight: 600, fontSize: 11 }}>
                    {opv.toFixed(2)}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ color: monoColor(lfv, 1.0, 1.2, false), fontWeight: 600, fontSize: 11 }}>
                    {lfv.toFixed(2)}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ color: monoColor(vr, 0.9, 0.6), fontWeight: 600, fontSize: 11 }}>
                    {vr.toFixed(2)}
                  </span>
                </td>
                <td>
                  <span className="mono" style={{
                    color: mom >= 0 ? 'var(--green)' : 'var(--red)',
                    fontWeight: 600, fontSize: 11,
                  }}>
                    {mom >= 0 ? '+' : ''}{mom.toFixed(2)}
                  </span>
                </td>
                <td>
                  {r.escalation_triggered
                    ? <span className="status red">Triggered</span>
                    : <span className="status green">Clear</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main ReviewsTab ──────────────────────────────────────────────
export default function ReviewsTab({
  projectId,
  project,
}: {
  projectId: string
  project: any
}) {
  const [reviews, setReviews]       = useState<Review[]>([])
  const [agendaData, setAgendaData] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  // Review form state
  const [attendedBy, setAttendedBy]         = useState('')
  const [reviewDate]                        = useState(new Date().toISOString().split('T')[0])
  const [discussionPoints, setDiscussion]   = useState('')
  const [blockers, setBlockers]             = useState('')
  const [actionsAgreed, setActions]         = useState('')

  // Per-item responses keyed by index string
  const [responses, setResponses] = useState<Record<string, AgendaResponse>>({})

  useEffect(() => {
    Promise.all([
      getReviews(projectId),
    ]).then(([reviewData]) => {
      setReviews(reviewData as Review[])
    }).finally(() => setLoading(false))
  }, [projectId])

  async function generateAgenda() {
    setGenerating(true); setError(null)
    try {
      const data = await getReviewAgenda(projectId)
      setAgendaData(data)
      // Initialise empty responses for each item
      const initResponses: Record<string, AgendaResponse> = {}
      const allItems = [
        ...(data.agenda?.critical || []).map((item: AgendaItem, i: number) => ({ item, key: `critical_${i}` })),
        ...(data.agenda?.watch || []).map((item: AgendaItem, i: number) => ({ item, key: `watch_${i}` })),
      ]
      allItems.forEach(({ item, key }) => {
        initResponses[key] = {
          task_id:            item.task_id || '',
          new_ecd:            '',
          what_done:          '',
          what_pending:       '',
          issue_blocker:      '',
          action_owner:       '',
          action_due_date:    '',
          impact_if_not_done: '',
        }
      })
      setResponses(initResponses)
    } catch (err: any) {
      setError('Failed to generate agenda. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function updateResponse(key: string, field: keyof AgendaResponse, value: string) {
    setResponses(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  async function handleSave() {
    if (!discussionPoints.trim()) {
      setError('Please fill in key discussion points before saving.')
      return
    }
    setSaving(true); setError(null)

    // Build task_updates array from responded agenda items
    const taskUpdates = Object.entries(responses)
      .filter(([, r]) => r.what_pending.trim().length > 0)
      .map(([, r]) => ({
        task_id:            r.task_id || null,
        new_ecd:            r.new_ecd || null,
        what_done:          r.what_done,
        what_pending:       r.what_pending,
        issue_blocker:      r.issue_blocker || null,
        action_owner:       r.action_owner,
        action_due_date:    r.action_due_date || null,
        impact_if_not_done: r.impact_if_not_done,
      }))
      .filter(item => item.task_id) // only task items, skip phase-level

    try {
      await createReviewFull(projectId, {
        review_date:       reviewDate,
        attended_by:       attendedBy,
        discussion_points: discussionPoints,
        blockers:          blockers || null,
        actions_agreed:    actionsAgreed || null,
        task_updates:      taskUpdates,
      })

      // Refresh reviews list
      const refreshed = await getReviews(projectId)
      setReviews(refreshed as Review[])
      setSuccess(true)
      setAgendaData(null)
      setResponses({})
      setAttendedBy(''); setDiscussion(''); setBlockers(''); setActions('')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save review.')
    } finally {
      setSaving(false)
    }
  }

  // Cadence info
  const nextReviewDue   = project?.next_review_due
  const daysUntilReview = nextReviewDue ? daysDiff(nextReviewDue) : null
  const isOverdue       = daysUntilReview !== null && daysUntilReview < 0

  const agenda: Agenda | null = agendaData?.agenda || null
  const respondedCount = Object.values(responses).filter(r => r.what_pending.trim().length > 0).length
  const totalItems     = (agenda?.critical?.length || 0) + (agenda?.watch?.length || 0)

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text4)' }}>Loading...</div>
  )

  return (
    <div>
      {/* Success banner */}
      {success && (
        <div className="alert-banner" style={{
          background: 'var(--green-bg)', border: '1px solid #B3D9C7',
          color: 'var(--green)', marginBottom: 16,
        }}>
          ✓ Review saved. ECDs updated, metrics recalculated. Next review due {fmt(nextReviewDue)}.
        </div>
      )}

      {/* Cadence indicator */}
      {nextReviewDue && (
        <div className={`alert-banner ${isOverdue ? 'red' : 'amber'}`} style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>
              {isOverdue
                ? `Review overdue by ${Math.abs(daysUntilReview!)} day${Math.abs(daysUntilReview!) !== 1 ? 's' : ''}`
                : `Next review due in ${daysUntilReview} day${daysUntilReview !== 1 ? 's' : ''}`
              }
            </div>
            <div style={{ fontSize: 11, marginTop: 2 }}>
              {project?.last_review_at
                ? `Last review: ${fmt(project.last_review_at.split('T')[0])}`
                : 'No reviews conducted yet'
              } · Due: {fmt(nextReviewDue)}
            </div>
          </div>
        </div>
      )}

      {/* AI Agenda section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ai-tag">AI</span>
            <div>
              <div className="card-title">Review agenda</div>
              <div className="card-sub">
                {agenda
                  ? `Generated · ${agenda.critical?.length || 0} critical · ${agenda.watch?.length || 0} watch · ${agenda.suggested_duration_minutes} min suggested`
                  : 'AI analyses task data to generate a prioritised agenda'
                }
              </div>
            </div>
          </div>
          <button
            className="ai-btn"
            onClick={generateAgenda}
            disabled={generating}
          >
            {generating
              ? <><div className="ai-spinner" />&nbsp;Generating...</>
              : agenda ? '✦ Regenerate' : '✦ Generate agenda'
            }
          </button>
        </div>

        {!agenda && !generating && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text4)', fontSize: 12 }}>
            Click "Generate agenda" to analyse task data and prepare your review
          </div>
        )}

        {agenda?.error && (
          <div className="alert-banner red" style={{ margin: '0 20px 16px' }}>
            ⚠ {agenda.error}
          </div>
        )}

        {agenda && !agenda.error && (
          <div style={{ padding: '0 20px 20px' }}>

            {/* Attended by + date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, marginTop: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">Attended by</label>
                <input
                  className="form-input"
                  value={attendedBy}
                  onChange={e => setAttendedBy(e.target.value)}
                  placeholder="e.g. Yuvaraj P., Ravi Kumar, Priya S."
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">Review date</label>
                <input
                  className="form-input"
                  value={new Date(reviewDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  readOnly
                  style={{ background: 'var(--bg)', color: 'var(--text3)' }}
                />
              </div>
            </div>

            {/* Critical items */}
            {agenda.critical && agenda.critical.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>
                  Critical · {agenda.critical.reduce((s, i) => s + i.suggested_minutes, 0)} min
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {agenda.critical.map((item: AgendaItem, i: number) => (
                    <AgendaItemCard
                      key={`critical_${i}`}
                      item={item}
                      index={i}
                      priority="critical"
                      response={responses[`critical_${i}`] || {
                        task_id: '', new_ecd: '', what_done: '', what_pending: '',
                        issue_blocker: '', action_owner: '', action_due_date: '', impact_if_not_done: '',
                      }}
                      onChange={(field, value) => updateResponse(`critical_${i}`, field, value)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Watch items */}
            {agenda.watch && agenda.watch.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 10 }}>
                  Watch · {agenda.watch.reduce((s, i) => s + i.suggested_minutes, 0)} min
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {agenda.watch.map((item: AgendaItem, i: number) => (
                    <AgendaItemCard
                      key={`watch_${i}`}
                      item={item}
                      index={i}
                      priority="watch"
                      response={responses[`watch_${i}`] || {
                        task_id: '', new_ecd: '', what_done: '', what_pending: '',
                        issue_blocker: '', action_owner: '', action_due_date: '', impact_if_not_done: '',
                      }}
                      onChange={(field, value) => updateResponse(`watch_${i}`, field, value)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick wins */}
            {agenda.quick_wins && agenda.quick_wins.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Quick wins · 5 min</div>
                <div style={{
                  background: 'var(--bg)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: 'var(--text)',
                  lineHeight: 2,
                }}>
                  {agenda.quick_wins.map((w: string, i: number) => (
                    <span key={i}>
                      <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span>{' '}
                      {w}
                      {i < agenda.quick_wins.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Overall narrative */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Overall narrative</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Key discussion points *</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={discussionPoints}
                    onChange={e => setDiscussion(e.target.value)}
                    placeholder="What was the main discussion today?"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Blockers identified</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={blockers}
                    onChange={e => setBlockers(e.target.value)}
                    placeholder="Any new blockers raised in the meeting?"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Actions agreed</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={actionsAgreed}
                    onChange={e => setActions(e.target.value)}
                    placeholder="What actions were agreed and who owns them?"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="alert-banner red" style={{ marginTop: 12 }}>⚠ {error}</div>
            )}

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {respondedCount > 0
                  ? `${respondedCount} of ${totalItems} items responded · Saving will apply ECD updates, post task updates, recalculate metrics`
                  : 'Saving will recalculate metrics and set next review date'
                }
              </div>
              <button
                className="tb-btn primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save review'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review history */}
      <ReviewHistory reviews={reviews} />
    </div>
  )
}
