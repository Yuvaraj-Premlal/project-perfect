import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLearning, getComments, addComment, deleteComment, toggleReaction } from '../api/projects'

const SECTION_LABELS: Record<string,string> = {
  project_overview:        'Project Overview',
  key_events_timeline:     'Key Events Timeline',
  what_went_right:         'What Went Right',
  what_went_wrong:         'What Went Wrong',
  stakeholder_performance: 'Stakeholder Performance',
  recommendations:         'Recommendations for Future Projects',
  pm_closing_remarks:      'PM Closing Remarks',
}

const SECTION_ACCENT: Record<string,string> = {
  what_went_right:  'var(--green)',
  what_went_wrong:  'var(--red)',
  recommendations:  'var(--blue)',
}

const TAG_LABELS: Record<string,string> = {
  we_experienced_this:   'We experienced this',
  different_outcome:     'Different outcome',
  useful_recommendation: 'Useful recommendation',
  general:               'General',
}

const REACTIONS = [
  { type: 'thumbs_up', emoji: '👍', label: 'Helpful' },
  { type: 'lightbulb', emoji: '💡', label: 'Insightful' },
  { type: 'warning',   emoji: '⚠️', label: 'Take note' },
]

export default function LearningDetail({ reportId, onBack }: { reportId: string, onBack: () => void }) {
  const qc = useQueryClient()
  const [commentBody, setCommentBody]   = useState('')
  const [commentTag, setCommentTag]     = useState('general')
  const [replyTo, setReplyTo]           = useState<string|null>(null)
  const [replyBody, setReplyBody]       = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const { data: report, isLoading } = useQuery({ queryKey: ['learning', reportId], queryFn: () => getLearning(reportId) })
  const { data: comments = [] }     = useQuery({ queryKey: ['learning-comments', reportId], queryFn: () => getComments(reportId) })

  async function handleReaction(type: string) {
    await toggleReaction(reportId, type)
    qc.invalidateQueries({ queryKey: ['learning', reportId] })
  }

  async function handleComment() {
    if (!commentBody.trim()) return
    setSubmitting(true)
    try {
      await addComment(reportId, { body: commentBody, tag: commentTag })
      setCommentBody('')
      setCommentTag('general')
      qc.invalidateQueries({ queryKey: ['learning-comments', reportId] })
      qc.invalidateQueries({ queryKey: ['learning', reportId] })
    } finally { setSubmitting(false) }
  }

  async function handleReply(parentId: string) {
    if (!replyBody.trim()) return
    setSubmitting(true)
    try {
      await addComment(reportId, { body: replyBody, parent_id: parentId, tag: 'general' })
      setReplyBody('')
      setReplyTo(null)
      qc.invalidateQueries({ queryKey: ['learning-comments', reportId] })
    } finally { setSubmitting(false) }
  }

  async function handleDelete(commentId: string) {
    await deleteComment(reportId, commentId)
    qc.invalidateQueries({ queryKey: ['learning-comments', reportId] })
    qc.invalidateQueries({ queryKey: ['learning', reportId] })
  }

  if (isLoading) return <div style={{ textAlign:'center', padding:60, color:'var(--text4)', fontSize:12 }}>Loading...</div>
  if (!report)   return <div style={{ textAlign:'center', padding:60, color:'var(--text4)', fontSize:12 }}>Not found.</div>

  const sections  = report.sections || {}
  const tags: string[] = report.tags || []
  const myReactions: string[] = report.my_reactions || []
  const variance  = report.days_variance || 0
  const outcomeText = variance === 0 ? 'Delivered on time' : variance > 0 ? `${variance} days late` : `${Math.abs(variance)} days early`
  const outcomeCls  = variance <= 0 ? 'green' : 'red'

  // Separate top-level and replies
  const topLevel  = (comments as any[]).filter((c: any) => !c.parent_id)
  const replies   = (comments as any[]).filter((c: any) => !!c.parent_id)

  return (
    <div>
      {/* Back */}
      <button className="tb-btn" style={{ marginBottom:16 }} onClick={onBack}>
        Back to Project Learnings
      </button>

      {/* Header */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header" style={{ alignItems:'flex-start' }}>
          <div>
            <div className="card-title" style={{ fontSize:18, marginBottom:4 }}>{report.project_name}</div>
            <div className="card-sub">{report.customer_name} - PM: {report.pm_name || 'Unknown'}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <span className={`status ${report.risk_tier === 'high' ? 'red' : report.risk_tier === 'medium' ? 'amber' : 'green'}`} style={{ textTransform:'capitalize' }}>{report.risk_tier} risk</span>
            <span className={`status ${outcomeCls}`}>{outcomeText}</span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:14 }}>
          {[
            { label:'Closed', val: report.actual_end_date ? new Date(report.actual_end_date).toLocaleDateString('en-GB') : '-' },
            { label:'Tasks completed', val: `${report.completed_tasks}/${report.total_tasks}` },
            { label:'Total slippages', val: report.total_slippages || 0 },
            { label:'Final OPV', val: report.final_opv ? `${(parseFloat(report.final_opv)*100).toFixed(1)}%` : '-' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg)', borderRadius:7, padding:'8px 12px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', fontFamily:'var(--mono)' }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {tags.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:14 }}>
            {tags.map((tag: string) => (
              <span key={tag} style={{ fontSize:10, background:'var(--bg2)', color:'var(--text3)', borderRadius:99, padding:'3px 10px', fontFamily:'var(--mono)' }}>
                {tag.replace(/-/g,' ')}
              </span>
            ))}
          </div>
        )}

        {/* Reactions */}
        <div style={{ display:'flex', gap:10, marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          {REACTIONS.map(r => {
            const count = parseInt(report[`${r.type}_count`] || 0)
            const active = myReactions.includes(r.type)
            return (
              <button key={r.type} onClick={() => handleReaction(r.type)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:99, border:`1.5px solid ${active ? 'var(--blue)' : 'var(--border)'}`, background: active ? 'var(--blue-bg, var(--bg2))' : 'var(--bg)', cursor:'pointer', fontSize:12, color: active ? 'var(--blue)' : 'var(--text3)', fontWeight: active ? 600 : 400 }}>
                <span>{r.emoji}</span>
                <span>{r.label}</span>
                {count > 0 && <span style={{ fontWeight:700 }}>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Case study sections */}
      {Object.entries(SECTION_LABELS).map(([key, label]) => {
        const text = sections[key]
        if (!text) return null
        const accent = SECTION_ACCENT[key] || 'var(--text3)'
        return (
          <div key={key} className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:accent, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>{label}</div>
            <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.85, whiteSpace:'pre-wrap' }}>{text}</div>
          </div>
        )
      })}

      {/* Comments */}
      <div className="card" style={{ marginTop:16 }}>
        <div className="card-header">
          <div className="card-title">Discussion</div>
          <span style={{ fontSize:11, color:'var(--text4)' }}>{(comments as any[]).filter((c:any) => !c.deleted).length} comments</span>
        </div>

        {/* Add comment */}
        <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
          <textarea className="form-input" rows={3} placeholder="Share your experience, a different outcome, or a useful recommendation..."
            value={commentBody} onChange={e => setCommentBody(e.target.value)}
            style={{ marginBottom:8, fontSize:12 }} />
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select className="form-input" style={{ fontSize:11, width:200 }} value={commentTag} onChange={e => setCommentTag(e.target.value)}>
              {Object.entries(TAG_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="tb-btn primary" disabled={submitting || !commentBody.trim()} onClick={handleComment}>
              {submitting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </div>

        {/* Comment list */}
        {topLevel.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'var(--text4)' }}>No comments yet. Be the first to share your experience.</div>
        )}
        {topLevel.map((c: any) => {
          const threadReplies = replies.filter((r: any) => r.parent_id === c.comment_id)
          return (
            <div key={c.comment_id} style={{ marginBottom:16 }}>
              <div style={{ background:'var(--bg)', borderRadius:8, padding:'12px 14px' }}>
                {c.deleted ? (
                  <div style={{ fontSize:12, color:'var(--text4)', fontStyle:'italic' }}>This comment has been removed.</div>
                ) : (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div style={{ width:26, height:26, borderRadius:99, background:'var(--blue)', color:'white', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {(c.author_name||'?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{c.author_name || 'Unknown'}</span>
                        {c.tag && c.tag !== 'general' && (
                          <span style={{ fontSize:10, background:'var(--bg2)', color:'var(--text3)', borderRadius:99, padding:'2px 8px' }}>{TAG_LABELS[c.tag] || c.tag}</span>
                        )}
                        <span style={{ fontSize:10, color:'var(--text4)' }}>{new Date(c.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="tb-btn" style={{ fontSize:10, padding:'2px 8px' }} onClick={() => setReplyTo(replyTo === c.comment_id ? null : c.comment_id)}>Reply</button>
                        <button className="tb-btn" style={{ fontSize:10, padding:'2px 8px', color:'var(--red)' }} onClick={() => handleDelete(c.comment_id)}>Remove</button>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>{c.body}</div>
                  </>
                )}
              </div>

              {/* Replies */}
              {threadReplies.map((r: any) => (
                <div key={r.comment_id} style={{ marginLeft:32, marginTop:8, background:'var(--bg)', borderRadius:8, padding:'10px 14px' }}>
                  {r.deleted ? (
                    <div style={{ fontSize:12, color:'var(--text4)', fontStyle:'italic' }}>This comment has been removed.</div>
                  ) : (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <div style={{ width:22, height:22, borderRadius:99, background:'var(--blue2)', color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {(r.author_name||'?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>{r.author_name || 'Unknown'}</span>
                          <span style={{ fontSize:10, color:'var(--text4)' }}>{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
                        </div>
                        <button className="tb-btn" style={{ fontSize:10, padding:'2px 8px', color:'var(--red)' }} onClick={() => handleDelete(r.comment_id)}>Remove</button>
                      </div>
                      <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>{r.body}</div>
                    </>
                  )}
                </div>
              ))}

              {/* Reply box */}
              {replyTo === c.comment_id && (
                <div style={{ marginLeft:32, marginTop:8, display:'flex', gap:8 }}>
                  <textarea className="form-input" rows={2} placeholder="Write a reply..."
                    value={replyBody} onChange={e => setReplyBody(e.target.value)}
                    style={{ flex:1, fontSize:12 }} />
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <button className="tb-btn primary" disabled={submitting || !replyBody.trim()} onClick={() => handleReply(c.comment_id)} style={{ fontSize:11 }}>Reply</button>
                    <button className="tb-btn" onClick={() => { setReplyTo(null); setReplyBody('') }} style={{ fontSize:11 }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
