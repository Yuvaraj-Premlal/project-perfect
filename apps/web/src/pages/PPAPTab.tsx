import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

async function fetchElements(projectId: string) {
  const r = await api.get(`/api/ppap/projects/${projectId}/elements`)
  return r.data
}
async function fetchUsers() {
  const r = await api.get('/api/ppap/users')
  return r.data
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function getHealth(elements: any[]) {
  if (!elements.length) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const total = elements.length
  const approved = elements.filter(e => e.status === 'approved').length
  const rejected = elements.filter(e => e.status === 'rejected').length
  const submitted = elements.filter(e => e.status === 'submitted').length
  const overdue = elements.filter(e =>
    e.status !== 'approved' && e.planned_end_date && new Date(e.planned_end_date) < today
  ).length
  const totalSubmissions = elements.reduce((sum, e) => sum + (parseInt(e.submission_count) || 0), 0)
  const submissionRate = Math.round((submitted + approved) / total * 100)
  let health: 'green' | 'amber' | 'red' = 'green'
  if (rejected >= 2 || overdue >= 2) health = 'red'
  else if (rejected >= 1 || overdue >= 1) health = 'amber'
  return { total, approved, rejected, submitted, overdue, submissionRate, totalSubmissions, health }
}

const HEALTH_LABELS: Record<string, { label: string, color: string, bg: string }> = {
  green: { label:'On Track', color:'var(--green)', bg:'var(--green-bg)' },
  amber: { label:'At Risk',  color:'var(--amber)', bg:'var(--amber-bg)' },
  red:   { label:'Overdue',  color:'var(--red)',   bg:'var(--red-bg)'   },
}

const STATUS_STYLE: Record<string, string> = {
  not_started: '',
  in_progress: 'blue',
  submitted:   'amber',
  approved:    'green',
  rejected:    'red',
}

function SubBadge({ count }: { count: number }) {
  const c = count === 0 ? '' : count === 1 ? 'green' : count === 2 ? 'amber' : 'red'
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:20, height:20, borderRadius:'50%', fontSize:10, fontWeight:700,
      background: c === 'green' ? 'var(--green-bg)' : c === 'amber' ? 'var(--amber-bg)' : c === 'red' ? 'var(--red-bg)' : 'var(--bg2)',
      color: c === 'green' ? 'var(--green)' : c === 'amber' ? 'var(--amber)' : c === 'red' ? 'var(--red)' : 'var(--text3)'
    }}>{count}</span>
  )
}

export default function PPAPTab({ projectId, canEdit }: { projectId: string, canEdit: boolean }) {
  const qc = useQueryClient()
  const { data: elements = [], isLoading } = useQuery({
    queryKey: ['ppap-elements', projectId],
    queryFn: () => fetchElements(projectId)
  })
  const [selected, setSelected] = useState<any>(null)
  const today = new Date(); today.setHours(0,0,0,0)
  const health = getHealth(elements)

  if (isLoading) return <div style={{ padding:32, textAlign:'center', color:'var(--text4)' }}>Loading PPAP elements...</div>

  if (elements.length === 0) return (
    <div style={{ padding:48, textAlign:'center' }}>
      <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>No PPAP elements set up yet</div>
      <div style={{ fontSize:13, color:'var(--text4)' }}>PPAP elements are created from the template selected when the project was created.</div>
    </div>
  )

  return (
    <div style={{ display:'flex', gap:0, height:'100%' }}>
      <div style={{ flex:1, overflowY:'auto' }}>
        {/* KPI bar */}
        {health && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
            <div className="kpi">
              <div className="kpi-label">Approved</div>
              <div className={`kpi-val ${health.approved === health.total ? 'green' : health.approved > 0 ? 'amber' : 'red'}`}>{health.approved}/{health.total}</div>
              <div className="kpi-sub">customer approved</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Submission Rate</div>
              <div className={`kpi-val ${health.submissionRate === 100 ? 'green' : health.submissionRate >= 50 ? 'amber' : 'red'}`}>{health.submissionRate}%</div>
              <div className="kpi-sub">sent to customer</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Overdue</div>
              <div className={`kpi-val ${health.overdue === 0 ? 'green' : health.overdue === 1 ? 'amber' : 'red'}`}>{health.overdue}</div>
              <div className="kpi-sub">past planned date</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total Submissions</div>
              <div className={`kpi-val ${health.totalSubmissions <= health.total ? 'green' : health.totalSubmissions <= health.total * 2 ? 'amber' : 'red'}`}>{health.totalSubmissions}</div>
              <div className="kpi-sub">across all elements</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">PPAP Health</div>
              <div style={{ marginTop:4 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:HEALTH_LABELS[health.health].bg, color:HEALTH_LABELS[health.health].color, borderRadius:99, padding:'4px 12px', fontSize:13, fontWeight:600 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:HEALTH_LABELS[health.health].color, display:'inline-block' }} />
                  {HEALTH_LABELS[health.health].label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
                {['#','Element','Days','Responsible','Start','Due','Submitted','Approved','FSA','Subs','Status','Last Update'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', fontSize:11, fontWeight:600, color:'var(--text3)', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elements.map((el: any) => {
                const isOverdue = el.status !== 'approved' && el.planned_end_date && new Date(el.planned_end_date) < today
                const isRejected = el.status === 'rejected'
                const fsaDays = el.approved_date && el.first_submitted_date
                  ? Math.round((new Date(el.approved_date).getTime() - new Date(el.first_submitted_date).getTime()) / 86400000)
                  : null
                const lastUpdate = el.updates?.[0]
                const rowBg = selected?.id === el.id ? 'var(--blue-light)' : isRejected ? '#FEF2F2' : isOverdue ? '#FEF9F9' : undefined
                const borderLeft = isRejected ? '3px solid var(--red)' : isOverdue ? '3px solid var(--amber)' : undefined

                return (
                  <tr key={el.id} onClick={() => setSelected(el)}
                    style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', background: rowBg }}
                    onMouseEnter={e => { if(selected?.id !== el.id) e.currentTarget.style.background = 'var(--bg2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg || '' }}>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text4)', borderLeft }}>{el.sequence_order}</td>
                    <td style={{ padding:'10px 12px', fontSize:13, fontWeight:500, color:'var(--text)' }}>{el.element_name}</td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text2)' }}>{el.planned_days}d</td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text2)' }}>{el.responsible_name || <span style={{ color:'var(--text4)' }}>—</span>}</td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:'var(--text2)', fontFamily:'var(--mono)' }}>{fmt(el.start_date)}</td>
                    <td style={{ padding:'10px 12px', fontSize:11, fontFamily:'var(--mono)', color: isOverdue ? 'var(--red)' : 'var(--text2)' }}>{fmt(el.planned_end_date)}</td>
                    <td style={{ padding:'10px 12px', fontSize:11, fontFamily:'var(--mono)', color: el.first_submitted_date ? 'var(--green)' : 'var(--text4)' }}>{fmt(el.first_submitted_date)}</td>
                    <td style={{ padding:'10px 12px', fontSize:11, fontFamily:'var(--mono)', color: el.approved_date ? 'var(--green)' : 'var(--text4)' }}>{fmt(el.approved_date)}</td>
                    <td style={{ padding:'10px 12px', fontSize:12 }}>
                      {fsaDays !== null ? <span style={{ color: fsaDays <= 5 ? 'var(--green)' : fsaDays <= 10 ? 'var(--amber)' : 'var(--red)', fontWeight:600 }}>{fsaDays}d</span> : <span style={{ color:'var(--text4)' }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 12px' }}><SubBadge count={parseInt(el.submission_count) || 0} /></td>
                    <td style={{ padding:'10px 12px' }}>
                      <span className={`status ${STATUS_STYLE[el.status] || ''}`} style={{ fontSize:11, textTransform:'capitalize' }}>
                        {el.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:12, color:'var(--text3)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {lastUpdate ? lastUpdate.update_text : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <PPAPSidePanel
          element={selected}
          projectId={projectId}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['ppap-elements', projectId] }); setSelected(null) }}
        />
      )}
    </div>
  )
}

function PPAPSidePanel({ element, projectId, canEdit, onClose, onSaved }:
  { element: any, projectId: string, canEdit: boolean, onClose: () => void, onSaved: () => void }) {

  const { data: users = [] } = useQuery<any[]>({ queryKey: ['admin-users'], queryFn: fetchUsers })
  const startAlreadySet = !!element.start_date
  const [startDate, setStartDate]         = useState(element.start_date || '')
  const [status, setStatus]               = useState(element.status === 'rejected' ? 'in_progress' : element.status)
  const [docRef, setDocRef]               = useState(element.doc_reference || '')
  const [updateText, setUpdateText]       = useState('')
  const [responsibleId, setResponsibleId] = useState(element.responsible_user_id || '')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  const previewEnd = startDate && !startAlreadySet
    ? (() => { const d = new Date(startDate); d.setDate(d.getDate() + element.planned_days); return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) })()
    : null

  async function handleSave() {
    if ((status === 'submitted' || status === 'approved') && !docRef.trim() && !element.doc_reference) {
      setError('Document reference is required to submit or approve'); return
    }
    setSaving(true); setError('')
    try {
      await api.patch(`/api/ppap/projects/${projectId}/elements/${element.id}`, {
        start_date: !startAlreadySet && startDate ? startDate : undefined,
        status,
        doc_reference: docRef || undefined,
        update_text: updateText || undefined,
        responsible_user_id: responsibleId || undefined,
      })
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  const isRejected = element.status === 'rejected'

  return (
    <div style={{ width:340, borderLeft:'1px solid var(--border)', padding:20, overflowY:'auto', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', lineHeight:1.4, flex:1, paddingRight:8 }}>{element.element_name}</div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text4)', fontSize:18, lineHeight:1 }}>×</button>
      </div>

      {/* Chips */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        <span style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text2)' }}>{element.planned_days} days planned</span>
        {element.planned_end_date && <span style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text2)' }}>Due: {new Date(element.planned_end_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>}
        {(parseInt(element.submission_count) || 0) > 0 && (
          <span style={{ fontSize:11, background:'var(--amber-bg)', border:'1px solid #FDE68A', borderRadius:99, padding:'2px 10px', color:'var(--amber)' }}>{element.submission_count} submission{element.submission_count !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Rejection alert */}
      {isRejected && (
        <div style={{ background:'var(--red-bg)', border:'1px solid #FCA5A5', borderRadius:7, padding:'10px 12px', marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--red)', marginBottom:4 }}>Currently Rejected — Rework Required</div>
          <div style={{ fontSize:11, color:'#9B1C1C', lineHeight:1.5 }}>Fix the issue and resubmit. Status reset to In Progress automatically.</div>
        </div>
      )}

      {canEdit && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Start date — immutable once set */}
          {!startAlreadySet ? (
            <div className="form-group">
              <label className="form-label">Start date</label>
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              {previewEnd && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Planned end: <strong>{previewEnd}</strong></div>}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Start date</label>
              <div style={{ fontSize:13, color:'var(--text2)', padding:'8px 11px', background:'var(--bg2)', borderRadius:7, border:'1px solid var(--border)' }}>
                {new Date(element.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6 }}>· immutable</span>
              </div>
            </div>
          )}

          {/* Responsible */}
          <div className="form-group">
            <label className="form-label">Responsible</label>
            <select className="form-input" value={responsibleId} onChange={e => setResponsibleId(e.target.value)}>
              <option value="">Select user</option>
              {(users as any[]).map((u: any) => (
                <option key={u.user_id} value={u.user_id}>{u.full_name} — {u.role?.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Doc reference */}
          {(status === 'submitted' || status === 'approved') && (
            <div className="form-group">
              <label className="form-label">Document reference *</label>
              <input className="form-input" value={docRef} onChange={e => setDocRef(e.target.value)} placeholder="Link or document name" />
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Required for submission and approval</div>
            </div>
          )}

          {/* Existing doc ref */}
          {element.doc_reference && status !== 'submitted' && status !== 'approved' && (
            <div style={{ fontSize:12, color:'var(--text2)', background:'var(--bg2)', borderRadius:6, padding:'8px 12px' }}>
              <span style={{ color:'var(--text4)' }}>Doc: </span>{element.doc_reference}
            </div>
          )}

          {/* Update note */}
          <div className="form-group">
            <label className="form-label">Update note</label>
            <textarea className="form-input" value={updateText} onChange={e => setUpdateText(e.target.value)}
              placeholder="What changed? What is the next action?"
              style={{ resize:'vertical', minHeight:72 }} />
          </div>

          {error && <div style={{ fontSize:12, color:'var(--red)', background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>}

          <div style={{ display:'flex', gap:8 }}>
            <button className="tb-btn" onClick={onClose}>Cancel</button>
            <button className="tb-btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* History */}
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
