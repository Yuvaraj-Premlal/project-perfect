import { useState, useEffect } from 'react'
import { getReviews, getReviewSummary, createReviewFull } from '../api/projects'

// ─── Types ────────────────────────────────────────────────────────
interface ActionItem {
  key_issue: string
  action_agreed: string
  responsible: string
  due_date: string
}

interface Review {
  review_id: string
  review_date: string
  attended_by: string | null
  ai_summary: string | null
  action_items: ActionItem[] | null
  discussion_points: string | null
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

function monoColor(val: number, good: number, bad: number, hib = true): string {
  if (hib) return val >= good ? 'var(--green)' : val <= bad ? 'var(--red)' : 'var(--amber)'
  return val <= good ? 'var(--green)' : val >= bad ? 'var(--red)' : 'var(--amber)'
}

function daysDiff(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function emptyAction(): ActionItem {
  return { key_issue: '', action_agreed: '', responsible: '', due_date: '' }
}

// ─── Review History Row ───────────────────────────────────────────
function ReviewHistoryRow({ r }: { r: Review }) {
  const [expanded, setExpanded] = useState(false)
  const opv = parseFloat(r.opv_snapshot)
  const lfv = parseFloat(r.lfv_snapshot || '1')
  const vr  = parseFloat(r.vr_snapshot || '0')
  const mom = parseFloat(r.momentum_snapshot || '0')

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
              style={{ flexShrink: 0, color: 'var(--text3)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="mono" style={{ fontSize: 11 }}>{fmt(r.review_date)}</span>
          </div>
        </td>
        <td style={{ fontSize: 11, color: 'var(--text3)' }}>{r.attended_by || r.conducted_by_name || '—'}</td>
        <td><span className="mono" style={{ color: monoColor(opv,1.0,0.8), fontWeight:600, fontSize:11 }}>{opv.toFixed(2)}</span></td>
        <td><span className="mono" style={{ color: monoColor(lfv,1.0,1.2,false), fontWeight:600, fontSize:11 }}>{lfv.toFixed(2)}</span></td>
        <td><span className="mono" style={{ color: monoColor(vr,0.9,0.6), fontWeight:600, fontSize:11 }}>{vr.toFixed(2)}</span></td>
        <td><span className="mono" style={{ color: mom>=0?'var(--green)':'var(--red)', fontWeight:600, fontSize:11 }}>{mom>=0?'+':''}{mom.toFixed(2)}</span></td>
        <td>{r.escalation_triggered ? <span className="status red">Triggered</span> : <span className="status green">Clear</span>}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0, background: 'var(--bg)' }}>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--border)' }}>

              {/* AI Summary */}
              {r.ai_summary && (
                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>AI summary</div>
                  <div style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)', borderRadius: 8, padding: '12px 16px' }}>
                    {r.ai_summary.split('\n').filter(l => l.trim()).map((line, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--ai)', fontWeight: 600, flexShrink: 0 }}>{line.match(/^\d+\./) ? '' : ''}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action items */}
              {r.action_items && r.action_items.filter(a => a.key_issue || a.action_agreed).length > 0 && (
                <div>
                  <div className="section-label" style={{ marginBottom: 8 }}>Action items</div>
                  <table className="tbl" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px' }}>Key issue</th>
                        <th>Action agreed</th>
                        <th>Responsible</th>
                        <th>Due by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.action_items.filter(a => a.key_issue || a.action_agreed).map((a, i) => (
                        <tr key={i}>
                          <td>{a.key_issue || '—'}</td>
                          <td>{a.action_agreed || '—'}</td>
                          <td>{a.responsible || '—'}</td>
                          <td className="mono">{a.due_date ? fmt(a.due_date) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!r.ai_summary && (!r.action_items || r.action_items.filter(a => a.key_issue).length === 0) && (
                <div style={{ fontSize: 12, color: 'var(--text4)' }}>No details recorded for this review.</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main ReviewsTab ──────────────────────────────────────────────
export default function ReviewsTab({
  projectId,
  project,
  // Lifted state — persists across tab switches
  aiSummary,
  setAiSummary,
  actionItems,
  setActionItems,
  attendedBy,
  setAttendedBy,
}: {
  projectId: string
  project: any
  aiSummary: string
  setAiSummary: (v: string) => void
  actionItems: ActionItem[]
  setActionItems: (v: ActionItem[]) => void
  attendedBy: string
  setAttendedBy: (v: string) => void
}) {
  const [reviews, setReviews]       = useState<Review[]>([])
  const [loading, setLoading]       = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    getReviews(projectId)
      .then((data: any) => setReviews(data as Review[]))
      .finally(() => setLoading(false))
  }, [projectId])

  async function generateSummary() {
    setGenerating(true); setError(null)
    try {
      const data = await getReviewSummary(projectId)
      setAiSummary(data.summary || '')
    } catch {
      setError('Failed to generate summary. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function updateActionItem(i: number, field: keyof ActionItem, value: string) {
    const updated = [...actionItems]
    updated[i] = { ...updated[i], [field]: value }
    setActionItems(updated)
  }

  function addRow() {
    setActionItems([...actionItems, emptyAction()])
  }

  function removeRow(i: number) {
    setActionItems(actionItems.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      await createReviewFull(projectId, {
        review_date:  new Date().toISOString().split('T')[0],
        attended_by:  attendedBy || null,
        ai_summary:   aiSummary || null,
        action_items: actionItems.filter(a => a.key_issue || a.action_agreed),
        discussion_points: null,
        blockers: null,
        actions_agreed: null,
        task_updates: [],
      })
      const refreshed = await getReviews(projectId)
      setReviews(refreshed as Review[])
      // Reset form after save
      setAiSummary('')
      setActionItems([emptyAction()])
      setAttendedBy('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save review.')
    } finally {
      setSaving(false)
    }
  }

  const nextReviewDue   = project?.next_review_due
  const daysUntilReview = nextReviewDue ? daysDiff(nextReviewDue) : null
  const isOverdue       = daysUntilReview !== null && daysUntilReview < 0

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text4)' }}>Loading...</div>

  return (
    <div>

      {/* Success banner */}
      {success && (
        <div className="alert-banner" style={{ background: 'var(--green-bg)', border: '1px solid #B3D9C7', color: 'var(--green)', marginBottom: 16 }}>
          ✓ Review saved successfully. Next review due {fmt(nextReviewDue)}.
        </div>
      )}

      {/* Cadence indicator */}
      {nextReviewDue && (
        <div className={`alert-banner ${isOverdue ? 'red' : 'amber'}`} style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>
              {isOverdue
                ? `Review overdue by ${Math.abs(daysUntilReview!)} day${Math.abs(daysUntilReview!) !== 1 ? 's' : ''}`
                : `Next review due in ${daysUntilReview} day${daysUntilReview !== 1 ? 's' : ''}`}
            </div>
            <div style={{ fontSize: 11, marginTop: 2 }}>
              {project?.last_review_at
                ? `Last review: ${fmt(project.last_review_at.split('T')[0])}`
                : 'No reviews conducted yet'} · Due: {fmt(nextReviewDue)}
            </div>
          </div>
        </div>
      )}

      {/* Conduct Review card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Conduct review</div>
            <div className="card-sub">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
          <button className="tb-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save review'}
          </button>
        </div>

        {error && <div className="alert-banner red" style={{ margin: '0 20px 16px' }}>⚠ {error}</div>}

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Attended by */}
          <div className="form-group">
            <label className="form-label">Attended by</label>
            <input
              className="form-input"
              value={attendedBy}
              onChange={e => setAttendedBy(e.target.value)}
              placeholder="e.g. Yuvaraj P., Ravi Kumar, Priya S."
              style={{ maxWidth: 400 }}
            />
          </div>

          {/* AI Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ai-tag">AI</span> Review summary
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  Bullet point summary of current project status
                </div>
              </div>
              <button className="ai-btn" onClick={generateSummary} disabled={generating}>
                {generating ? <><div className="ai-spinner" />&nbsp;Generating...</> : aiSummary ? '✦ Regenerate' : '✦ Generate summary'}
              </button>
            </div>

            {aiSummary ? (
              <div style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)', borderRadius: 8, padding: '14px 16px' }}>
                {aiSummary.split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--ai)', fontWeight: 600, flexShrink: 0, minWidth: 16 }}>✦</span>
                    <span>{line.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text4)' }}>
                Click "Generate summary" to get an AI briefing based on current task data
              </div>
            )}
          </div>

          {/* Action items table */}
          <div>
            <div className="section-label" style={{ marginBottom: 10 }}>Action items</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: '28%' }}>Key issue</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: '28%' }}>Action agreed</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: '20%' }}>Responsible</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: '16%' }}>Due by</th>
                  <th style={{ width: '8%' }}></th>
                </tr>
              </thead>
              <tbody>
                {actionItems.map((item, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 6px 6px 0' }}>
                      <input
                        className="form-input"
                        value={item.key_issue}
                        onChange={e => updateActionItem(i, 'key_issue', e.target.value)}
                        placeholder="Describe the issue..."
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        className="form-input"
                        value={item.action_agreed}
                        onChange={e => updateActionItem(i, 'action_agreed', e.target.value)}
                        placeholder="What was agreed..."
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        className="form-input"
                        value={item.responsible}
                        onChange={e => updateActionItem(i, 'responsible', e.target.value)}
                        placeholder="Owner..."
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        className="form-input"
                        type="date"
                        value={item.due_date}
                        onChange={e => updateActionItem(i, 'due_date', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      {actionItems.length > 1 && (
                        <button
                          onClick={() => removeRow(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', fontSize: 16, lineHeight: 1, padding: '2px 6px' }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="tb-btn"
              onClick={addRow}
              style={{ marginTop: 8, fontSize: 11 }}
            >
              + Add row
            </button>
          </div>

        </div>
      </div>

      {/* Review history */}
      {reviews.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Review history</div>
              <div className="card-sub">Click any row to see full review details</div>
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
              {reviews.map((r: Review) => (
                <ReviewHistoryRow key={r.review_id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
