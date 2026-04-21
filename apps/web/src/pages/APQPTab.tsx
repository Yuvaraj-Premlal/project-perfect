import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

async function fetchElements(projectId: string) {
  const res = await api.get(`/api/apqp/projects/${projectId}/elements`)
  return res.data
}

function getHealth(elements: any[]) {
  if (elements.length === 0) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const total = elements.length
  const completed = elements.filter(e => e.status === 'complete').length
  const overdue = elements.filter(e =>
    e.status !== 'complete' && e.planned_end_date && new Date(e.planned_end_date) < today
  ).length
  const onTime = elements.filter(e => {
    if (e.status !== 'complete' || !e.completed_date || !e.planned_end_date) return false
    return new Date(e.completed_date) <= new Date(e.planned_end_date)
  }).length
  const completionRate = Math.round(completed / total * 100)
  const onTimeRate = completed > 0 ? Math.round(onTime / completed * 100) : null
  let health: 'green' | 'amber' | 'red' = 'green'
  if (overdue >= 3 || completionRate < 50) health = 'red'
  else if (overdue >= 1 || completionRate < 75) health = 'amber'
  return { total, completed, overdue, completionRate, onTimeRate, health }
}

function dayDiff(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

const HEALTH_LABELS: Record<string, { label: string, color: string, bg: string }> = {
  green: { label: 'On Track',  color: 'var(--green)',  bg: 'var(--green-bg)' },
  amber: { label: 'At Risk',   color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  red:   { label: 'Overdue',   color: 'var(--red)',    bg: 'var(--red-bg)'   },
}

export default function APQPTab({ projectId, canEdit }: { projectId: string, canEdit: boolean }) {
  const qc = useQueryClient()
  const { data: elements = [], isLoading } = useQuery({
    queryKey: ['apqp-elements', projectId],
    queryFn: () => fetchElements(projectId)
  })

  const [selected, setSelected] = useState<any>(null)
  const today = new Date(); today.setHours(0,0,0,0)
  const health = getHealth(elements)

  if (isLoading) return <div style={{ padding:32, textAlign:'center', color:'var(--text4)' }}>Loading APQP elements...</div>

  if (elements.length === 0) return (
    <div style={{ padding:48, textAlign:'center' }}>
      <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>No APQP elements set up yet</div>
      <div style={{ fontSize:13, color:'var(--text4)' }}>APQP elements are created from the template selected when the project was created.</div>
    </div>
  )

  return (
    <div style={{ display:'flex', gap:0, height:'100%' }}>
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* KPI bar */}
        {health && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            <div className="kpi">
              <div className="kpi-label">Completion</div>
              <div className={`kpi-val ${health.completionRate === 100 ? 'green' : health.completionRate >= 75 ? 'amber' : 'red'}`}>
                {health.completed}/{health.total}
              </div>
              <div className="kpi-sub">{health.completionRate}% done</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">On-Time Rate</div>
              <div className={`kpi-val ${health.onTimeRate === null ? '' : health.onTimeRate === 100 ? 'green' : health.onTimeRate >= 75 ? 'amber' : 'red'}`}>
                {health.onTimeRate === null ? '—' : `${health.onTimeRate}%`}
              </div>
              <div className="kpi-sub">of completed elements</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Overdue</div>
              <div className={`kpi-val ${health.overdue === 0 ? 'green' : health.overdue <= 2 ? 'amber' : 'red'}`}>
                {health.overdue}
              </div>
              <div className="kpi-sub">elements past due</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">APQP Health</div>
              <div style={{ marginTop:4 }}>
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:6,
                  background: HEALTH_LABELS[health.health].bg,
                  color: HEALTH_LABELS[health.health].color,
                  borderRadius:99, padding:'4px 12px', fontSize:13, fontWeight:600
                }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background: HEALTH_LABELS[health.health].color, display:'inline-block' }} />
                  {HEALTH_LABELS[health.health].label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Elements table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
                {['#','Element','Days','Start','Due','Days Left','Delay','Status','Last Update'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:600, color:'var(--text3)', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elements.map((el: any) => {
                const isOverdue = el.status !== 'complete' && el.planned_end_date && new Date(el.planned_end_date) < today
                const daysLeft = el.status !== 'complete' && el.planned_end_date && new Date(el.planned_end_date) >= today
                  ? dayDiff(today.toISOString().split('T')[0], el.planned_end_date)
                  : null
                const delayDays = isOverdue ? dayDiff(el.planned_end_date, today.toISOString().split('T')[0]) : null
                const lastUpdate = el.updates?.[0]

                return (
                  <tr key={el.id}
                    onClick={() => setSelected(el)}
                    style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', background: selected?.id === el.id ? 'var(--blue-light)' : undefined }}
                    onMouseEnter={e => (e.currentTarget.style.background = selected?.id === el.id ? 'var(--blue-light)' : 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = selected?.id === el.id ? 'var(--blue-light)' : '')}>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text4)' }}>{el.sequence_order}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:500, color:'var(--text)' }}>{el.element_name}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{el.planned_days}d</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)' }}>{fmt(el.start_date)}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)' }}>{fmt(el.planned_end_date)}</td>
                    <td style={{ padding:'10px 14px', fontSize:12 }}>
                      {el.status === 'complete' ? <span style={{ color:'var(--green)' }}>—</span>
                        : daysLeft !== null ? <span style={{ color: daysLeft <= 2 ? 'var(--amber)' : 'var(--text2)' }}>{daysLeft}d</span>
                        : <span style={{ color:'var(--text4)' }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12 }}>
                      {delayDays ? <span style={{ color:'var(--red)', fontWeight:600 }}>+{delayDays}d</span> : <span style={{ color:'var(--text4)' }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span className={`status ${el.status === 'complete' ? 'green' : el.status === 'in_progress' ? 'blue' : ''}`}
                        style={{ fontSize:11, textTransform:'capitalize' }}>
                        {el.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text3)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {lastUpdate ? lastUpdate.update_text : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <APQPSidePanel
          element={selected}
          projectId={projectId}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['apqp-elements', projectId] })
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Side Panel ───────────────────────────────────────────────────
function APQPSidePanel({ element, projectId, canEdit, onClose, onSaved }:
  { element: any, projectId: string, canEdit: boolean, onClose: () => void, onSaved: () => void }) {

  const startAlreadySet = !!element.start_date
  const [startDate, setStartDate]   = useState(element.start_date || '')
  const [status, setStatus]         = useState(element.status)
  const [docRef, setDocRef]         = useState(element.doc_reference || '')
  const [updateText, setUpdateText] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Calculate preview end date
  const previewEnd = startDate
    ? (() => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + element.planned_days)
        return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
      })()
    : null

  async function handleSave() {
    if (status === 'complete' && !docRef.trim()) {
      setError('Document reference is required to mark as complete')
      return
    }
    setSaving(true); setError('')
    try {
      await api.patch(`/api/apqp/projects/${projectId}/elements/${element.id}`, {
        start_date:   !startAlreadySet && startDate ? startDate : undefined,
        status,
        doc_reference: docRef || undefined,
        update_text:   updateText || undefined,
      })
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ width:340, borderLeft:'1px solid var(--border)', padding:20, overflowY:'auto', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', lineHeight:1.4, flex:1, paddingRight:8 }}>{element.element_name}</div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text4)', fontSize:18, lineHeight:1 }}>×</button>
      </div>

      {/* Info chips */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text2)' }}>
          {element.planned_days} days planned
        </span>
        {element.planned_end_date && (
          <span style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text2)' }}>
            Due: {fmt(element.planned_end_date)}
          </span>
        )}
        {element.start_date && (
          <span style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text2)' }}>
            Started: {fmt(element.start_date)}
          </span>
        )}
      </div>

      {canEdit && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Start date — only if not yet set */}
          {!startAlreadySet && (
            <div className="form-group">
              <label className="form-label">Start date</label>
              <input type="date" className="form-input" value={startDate}
                onChange={e => setStartDate(e.target.value)} />
              {previewEnd && (
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                  Planned end: <strong>{previewEnd}</strong>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {/* Doc reference — required on completion */}
          {status === 'complete' && (
            <div className="form-group">
              <label className="form-label">Document reference *</label>
              <input className="form-input" value={docRef}
                onChange={e => setDocRef(e.target.value)}
                placeholder="e.g. feasibility_v2.pdf or SharePoint link" />
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Required — link or document name</div>
            </div>
          )}

          {/* Show existing doc ref if already complete */}
          {element.status === 'complete' && element.doc_reference && (
            <div style={{ fontSize:12, color:'var(--text2)', background:'var(--bg2)', borderRadius:6, padding:'8px 12px' }}>
              <span style={{ color:'var(--text4)' }}>Doc: </span>{element.doc_reference}
            </div>
          )}

          {/* Update note */}
          <div className="form-group">
            <label className="form-label">Update note</label>
            <textarea className="form-input" value={updateText}
              onChange={e => setUpdateText(e.target.value)}
              placeholder="What's the current status or next action?"
              style={{ resize:'vertical', minHeight:72 }} />
          </div>

          {error && (
            <div style={{ fontSize:12, color:'var(--red)', background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button className="tb-btn" onClick={onClose}>Cancel</button>
            <button className="tb-btn primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Update history */}
      {element.updates?.length > 0 && (
        <div style={{ marginTop:20, borderTop:'1px solid var(--border)', paddingTop:16 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>History</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {element.updates.map((u: any) => (
              <div key={u.id} style={{ fontSize:12, color:'var(--text2)', background:'var(--bg2)', borderRadius:6, padding:'8px 12px', borderLeft:'3px solid var(--blue)' }}>
                <div style={{ marginBottom:4 }}>{u.update_text}</div>
                <div style={{ fontSize:10, color:'var(--text4)', display:'flex', justifyContent:'space-between' }}>
                  <span>{u.created_by_name || 'Unknown'}</span>
                  <span>{new Date(u.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
