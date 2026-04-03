import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getReviewAgenda, createReviewFull, getReviews } from '../api/projects'

interface TaskAgendaItem {
  task_id: string
  task_name: string
  risk_label: string
  risk_number: number
  current_ecd: string | null
  delay_days: number
  control_type: string
  ai_questions: string[]
}

interface CustomPoint {
  id: string
  text: string
}

interface TaskResponse {
  response: string
  extra_points: CustomPoint[]
}

export default function ReviewsTab({
  projectId,
  tasks,
  agenda,
  setAgenda,
  responses,
  setResponses,
  customPoints,
  setCustomPoints,
  attendedBy,
  setAttendedBy,
  canEdit = true,
}: {
  projectId: string
  tasks: any[]
  agenda: TaskAgendaItem[]
  setAgenda: (a: TaskAgendaItem[]) => void
  responses: Record<string, TaskResponse>
  setResponses: (r: Record<string, TaskResponse>) => void
  customPoints: CustomPoint[]
  setCustomPoints: (p: CustomPoint[]) => void
  attendedBy: string
  setAttendedBy: (s: string) => void
  canEdit?: boolean
}) {
  const qc = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', projectId],
    queryFn: () => getReviews(projectId)
  })

  // Sort incomplete tasks by risk number descending
  const incompleteTasks = (tasks as any[])
    .filter(t => t.completion_status !== 'complete')
    .sort((a, b) => (b.risk_number || 0) - (a.risk_number || 0))

  async function handleGenerateAgenda() {
    setGenerating(true)
    setError('')
    try {
      const data = await getReviewAgenda(projectId)
      // Build agenda items from tasks + AI questions
      const agendaItems: TaskAgendaItem[] = incompleteTasks.map(t => {
        // Find matching AI question from agenda response
        const aiItem = [
          ...(data?.agenda?.critical || data?.critical || []),
          ...(data?.agenda?.watch || data?.watch || [])
        ].find((item: any) => item.task_id === t.task_id || item.task_name === t.task_name)

        return {
          task_id:      t.task_id,
          task_name:    t.task_name,
          risk_label:   t.risk_label,
          risk_number:  t.risk_number || 0,
          current_ecd:  t.current_ecd,
          delay_days:   t.delay_days || 0,
          control_type: t.control_type,
          ai_questions: aiItem?.ai_question
            ? [aiItem.ai_question]
            : [`What is the current status of "${t.task_name}"?`, `Are there any blockers preventing completion?`]
        }
      })
      setAgenda(agendaItems)
      // Initialise empty responses for each task
      const initResponses: Record<string, TaskResponse> = {}
      agendaItems.forEach(item => {
        if (!responses[item.task_id]) {
          initResponses[item.task_id] = { response: '', extra_points: [] }
        }
      })
      setResponses({ ...responses, ...initResponses })
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate agenda')
    } finally {
      setGenerating(false)
    }
  }

  function updateResponse(taskId: string, value: string) {
    setResponses({
      ...responses,
      [taskId]: { ...responses[taskId], response: value }
    })
  }

  function addExtraPoint(taskId: string) {
    const current = responses[taskId] || { response: '', extra_points: [] }
    setResponses({
      ...responses,
      [taskId]: {
        ...current,
        extra_points: [...current.extra_points, { id: Date.now().toString(), question: '', answer: '', text: '' }]
      }
    })
  }

  function updateExtraPoint(taskId: string, pointId: string, question: string, answer: string) {
    const current = responses[taskId] || { response: '', extra_points: [] }
    setResponses({
      ...responses,
      [taskId]: {
        ...current,
        extra_points: current.extra_points.map(p =>
          p.id === pointId ? { ...p, question, answer, text: question } : p
        )
      }
    })
  }

  function removeExtraPoint(taskId: string, pointId: string) {
    const current = responses[taskId] || { response: '', extra_points: [] }
    setResponses({
      ...responses,
      [taskId]: {
        ...current,
        extra_points: current.extra_points.filter(p => p.id !== pointId)
      }
    })
  }

  function addCustomPoint() {
    setCustomPoints([...customPoints, { id: Date.now().toString(), text: '' }])
  }

  function updateCustomPoint(id: string, value: string) {
    setCustomPoints(customPoints.map(p => p.id === id ? { ...p, text: value } : p))
  }

  function removeCustomPoint(id: string) {
    setCustomPoints(customPoints.filter(p => p.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      // Build review_responses for DB
      const reviewResponses = agenda.map(item => ({
        task_id:      item.task_id,
        task_name:    item.task_name,
        ai_questions: item.ai_questions,
        pm_response:  responses[item.task_id]?.response || '',
        extra_points: responses[item.task_id]?.extra_points || []
      }))

      await createReviewFull(projectId, {
        review_date:      new Date().toISOString().split('T')[0],
        attended_by:      attendedBy,
        discussion_points: reviewResponses.map(r =>
          `${r.task_name}: ${r.pm_response}`
        ).filter(Boolean).join('\n'),
        review_responses: reviewResponses,
        action_items:     customPoints.filter(p => p.text.trim()),
      })

      // Clear the draft
      setAgenda([])
      setResponses({})
      setCustomPoints([])
      setAttendedBy('')
      setSuccess('Review saved successfully')
      qc.invalidateQueries({ queryKey: ['reviews', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  const riskColor = (label: string) =>
    label === 'high_risk' ? 'var(--red)' : label === 'medium_risk' ? 'var(--amber)' : 'var(--green)'

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>Review Meeting</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>Generate agenda, capture decisions, save record</div>
        </div>
        {canEdit && agenda.length > 0 && (
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <input className="form-input" placeholder="Attended by (names)"
              value={attendedBy} onChange={e => setAttendedBy(e.target.value)}
              style={{ fontSize:12, width:220 }} />
            <button className="tb-btn primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Review'}
            </button>
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          {canEdit && (
            <button className="ai-btn" onClick={handleGenerateAgenda} disabled={generating}>
              {generating ? <><div className="ai-spinner" />&nbsp;Generating...</> : agenda.length > 0 ? '* Regenerate Agenda' : '* Generate Agenda'}
            </button>
          )}
          {agenda.length > 0 && (
            <button className="tb-btn" onClick={() => { setAgenda([]); setResponses({}); setCustomPoints([]) }} style={{ fontSize:11 }}>Clear</button>
          )}
        </div>
      </div>

      {error && <div className="alert-banner red" style={{ marginBottom:12 }}>! {error}</div>}
      {success && <div className="alert-banner green" style={{ marginBottom:12 }}>{success}</div>}

      {/* Agenda */}
      {agenda.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
          {agenda.map(item => (
            <div key={item.task_id} className="card">
              {/* Task header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{item.task_name}</div>
                  <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--text3)' }}>
                    <span style={{ color: riskColor(item.risk_label), fontWeight:600 }}>
                      {item.risk_label?.replace('_',' ').toUpperCase()}
                    </span>
                    {item.current_ecd && <span>ECD: {new Date(item.current_ecd).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })}</span>}
                    {item.delay_days > 0 && <span style={{ color:'var(--red)' }}>+{item.delay_days}d delay</span>}
                    <span style={{ textTransform:'capitalize' }}>{item.control_type?.replace('_',' ')}</span>
                  </div>
                </div>
                <span style={{ fontSize:11, color:'var(--text4)', background:'var(--bg2)', borderRadius:99, padding:'2px 10px' }}>
                  RN {item.risk_number}
                </span>
              </div>

              {/* AI questions */}
              <div style={{ marginBottom:10 }}>
                {item.ai_questions.map((q, i) => (
                  <div key={i} style={{ fontSize:12, color:'var(--blue)', marginBottom:4, display:'flex', gap:6 }}>
                    <span style={{ opacity:0.5 }}>Q{i+1}.</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>

              {/* PM response */}
              <textarea className="form-input" rows={3}
                placeholder="Capture discussion, decisions and actions agreed for this task..."
                value={responses[item.task_id]?.response || ''}
                onChange={e => updateResponse(item.task_id, e.target.value)}
                style={{ fontSize:12, marginBottom:8 }} />

              {/* Extra points */}
              {(responses[item.task_id]?.extra_points || []).map((point, pi) => (
                <div key={point.id} style={{ marginBottom:10, borderLeft:'2px solid var(--border)', paddingLeft:12 }}>
                  <div style={{ display:'flex', gap:8, marginBottom:4, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--blue)', opacity:0.7, whiteSpace:'nowrap' }}>Q{item.ai_questions.length + pi + 1}.</span>
                    <input className="form-input" placeholder="Type your question..."
                      value={point.question || ''}
                      onChange={e => updateExtraPoint(item.task_id, point.id, e.target.value, point.answer || '')}
                      style={{ fontSize:12, flex:1 }} />
                    <button className="tb-btn" style={{ fontSize:11, color:'var(--red)', flexShrink:0 }}
                      onClick={() => removeExtraPoint(item.task_id, point.id)}>Remove</button>
                  </div>
                  <textarea className="form-input" rows={2}
                    placeholder="Response / decision..."
                    value={point.answer || ''}
                    onChange={e => updateExtraPoint(item.task_id, point.id, point.question || '', e.target.value)}
                    style={{ fontSize:12 }} />
                </div>
              ))}

              <button className="tb-btn" style={{ fontSize:11 }}
                onClick={() => addExtraPoint(item.task_id)}>
                + Add point
              </button>
            </div>
          ))}

          {/* Custom standalone points */}
          <div className="card">
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:12 }}>
              Additional Agenda Items
            </div>
            {customPoints.map(point => (
              <div key={point.id} style={{ display:'flex', gap:8, marginBottom:8 }}>
                <input className="form-input" placeholder="Add a standalone agenda item..."
                  value={point.text}
                  onChange={e => updateCustomPoint(point.id, e.target.value)}
                  style={{ fontSize:12, flex:1 }} />
                <button className="tb-btn" style={{ fontSize:11, color:'var(--red)' }}
                  onClick={() => removeCustomPoint(point.id)}>Remove</button>
              </div>
            ))}
            <button className="tb-btn" style={{ fontSize:11 }} onClick={addCustomPoint}>
              + Add agenda item
            </button>
          </div>
        </div>
      )}

      {/* Review History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Review History</div>
          <span style={{ fontSize:11, color:'var(--text4)' }}>Click any row to see full details</span>
        </div>
        {(reviews as any[]).length === 0 && (
          <div style={{ textAlign:'center', padding:32, fontSize:12, color:'var(--text4)' }}>
            No reviews conducted yet
          </div>
        )}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Date','Attended by','OPV','LFV','Momentum','Escalation'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, color:'var(--text3)', fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(reviews as any[]).map((r: any) => (
              <ReviewRow key={r.review_id} review={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReviewRow({ review }: { review: any }) {
  const [open, setOpen] = useState(false)
  const responses: any[] = review.review_responses || []
  const customPoints: any[] = review.action_items || []

  return (
    <>
      <tr style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
        onClick={() => setOpen(!open)}>
        <td style={{ padding:'10px 12px', fontWeight:500 }}>
          {new Date(review.review_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
        </td>
        <td style={{ padding:'10px 12px', color:'var(--text2)' }}>{review.attended_by || '-'}</td>
        <td style={{ padding:'10px 12px', color: parseFloat(review.opv_snapshot) >= 0.8 ? 'var(--green)' : 'var(--red)', fontWeight:600, fontFamily:'var(--mono)' }}>
          {parseFloat(review.opv_snapshot).toFixed(2)}
        </td>
        <td style={{ padding:'10px 12px', color: parseFloat(review.lfv_snapshot) <= 1.2 ? 'var(--green)' : 'var(--red)', fontWeight:600, fontFamily:'var(--mono)' }}>
          {parseFloat(review.lfv_snapshot).toFixed(2)}
        </td>
        <td style={{ padding:'10px 12px', color: parseFloat(review.momentum_snapshot) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600, fontFamily:'var(--mono)' }}>
          {parseFloat(review.momentum_snapshot) >= 0 ? '+' : ''}{parseFloat(review.momentum_snapshot).toFixed(2)}
        </td>
        <td style={{ padding:'10px 12px' }}>
          {review.escalation_triggered
            ? <span className="status red">Triggered</span>
            : <span className="status green">Clear</span>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background:'var(--bg)', padding:'16px 20px' }}>
            {responses.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {responses.map((r: any, i: number) => (
                  <div key={i} style={{ borderLeft:'3px solid var(--blue)', paddingLeft:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{r.task_name}</div>
                    {r.ai_questions?.map((q: string, qi: number) => (
                      <div key={qi} style={{ fontSize:11, color:'var(--blue)', marginBottom:4, opacity:0.8 }}>Q{qi+1}. {q}</div>
                    ))}
                    {r.pm_response && (
                      <div style={{ fontSize:12, color:'var(--text2)', marginTop:6, padding:'8px 12px', background:'white', borderRadius:6, lineHeight:1.7 }}>
                        {r.pm_response}
                      </div>
                    )}
                    {r.extra_points?.filter((p:any) => p.text).map((p: any, pi: number) => (
                      <div key={pi} style={{ fontSize:12, color:'var(--text3)', marginTop:6, padding:'6px 12px', background:'white', borderRadius:6, borderLeft:'2px solid var(--border)' }}>
                        - {p.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : review.discussion_points ? (
              <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>{review.discussion_points}</div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text4)' }}>No details recorded</div>
            )}
            {customPoints.length > 0 && (
              <div style={{ marginTop:16, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:8 }}>Additional Agenda Items</div>
                {customPoints.map((p: any, i: number) => (
                  <div key={i} style={{ fontSize:12, color:'var(--text2)', marginBottom:6, padding:'6px 12px', background:'white', borderRadius:6 }}>
                    - {p.text || p}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
