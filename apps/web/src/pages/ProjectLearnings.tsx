import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLearnings } from '../api/projects'

const RISK_COLOR: Record<string,string> = {
  high:   'red',
  medium: 'amber',
  low:    'green',
}

const TAG_LABELS: Record<string,string> = {
  we_experienced_this:    'We experienced this',
  different_outcome:      'Different outcome',
  useful_recommendation:  'Useful recommendation',
  general:                'General',
}

function excerpt(sections: any): string {
  if (!sections) return ''
  const text = sections.project_overview || sections.what_went_right || ''
  return text.length > 180 ? text.slice(0, 180) + '...' : text
}

export default function ProjectLearnings({ onOpenLearning }: { onOpenLearning: (id: string) => void }) {
  const { data: learnings = [], isLoading } = useQuery({ queryKey: ['learnings'], queryFn: getLearnings })
  const [search, setSearch]     = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [filterOutcome, setFilterOutcome] = useState('')

  // Collect all unique tags
  const allTags: string[] = Array.from(new Set((learnings as any[]).flatMap((l: any) => l.tags || [])))

  const filtered = (learnings as any[]).filter((l: any) => {
    const sections = l.sections || {}
    const text = [l.project_name, l.customer_name, sections.project_overview, sections.what_went_right, sections.what_went_wrong].join(' ').toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false
    if (filterTag && !(l.tags || []).includes(filterTag)) return false
    if (filterRisk && l.risk_tier !== filterRisk) return false
    if (filterOutcome === 'late'     && (l.days_variance || 0) <= 0) return false
    if (filterOutcome === 'ontime'   && (l.days_variance || 0) > 0)  return false
    if (filterOutcome === 'early'    && (l.days_variance || 0) >= 0) return false
    return true
  })

  if (isLoading) return <div style={{ textAlign:'center', padding:60, color:'var(--text4)', fontSize:12 }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Project Learnings</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Case studies from closed projects - organisational knowledge for future PMs</div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input
          className="form-input"
          style={{ flex:1, minWidth:200, fontSize:12 }}
          placeholder="Search projects, customers, lessons..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="form-input" style={{ fontSize:12, width:140 }} value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
          <option value="">All risk tiers</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="form-input" style={{ fontSize:12, width:140 }} value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
          <option value="">All outcomes</option>
          <option value="ontime">On time</option>
          <option value="late">Late</option>
          <option value="early">Early</option>
        </select>
        <select className="form-input" style={{ fontSize:12, width:180 }} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t.replace(/-/g,' ')}</option>)}
        </select>
        {(search || filterTag || filterRisk || filterOutcome) && (
          <button className="tb-btn" onClick={() => { setSearch(''); setFilterTag(''); setFilterRisk(''); setFilterOutcome('') }}>Clear</button>
        )}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'var(--text4)', fontSize:12 }}>
          {(learnings as any[]).length === 0 ? 'No closed projects yet. Case studies will appear here once projects are closed.' : 'No results match your filters.'}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>
        {filtered.map((l: any) => {
          const variance = l.days_variance || 0
          const outcomeText  = variance === 0 ? 'On time' : variance > 0 ? `${variance}d late` : `${Math.abs(variance)}d early`
          const outcomeCls   = variance === 0 ? 'green' : variance > 0 ? 'red' : 'green'
          const tags: string[] = l.tags || []
          const thumbs   = parseInt(l.thumbs_up_count  || 0)
          const bulb     = parseInt(l.lightbulb_count  || 0)
          const warning  = parseInt(l.warning_count    || 0)
          const comments = parseInt(l.comment_count    || 0)
          return (
            <div key={l.report_id} className="card" style={{ cursor:'pointer', transition:'box-shadow 0.15s' }}
              onClick={() => onOpenLearning(l.report_id)}>
              <div className="card-header" style={{ alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div className="card-title" style={{ marginBottom:2 }}>{l.project_name}</div>
                  <div className="card-sub">{l.customer_name} - {l.pm_name || 'Unknown PM'}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  <span className={`status ${RISK_COLOR[l.risk_tier] || 'blue'}`} style={{ textTransform:'capitalize' }}>{l.risk_tier} risk</span>
                  <span className={`status ${outcomeCls}`}>{outcomeText}</span>
                </div>
              </div>

              <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.7, margin:'10px 0', minHeight:54 }}>
                {excerpt(l.sections)}
              </div>

              {tags.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                  {tags.slice(0,4).map((tag: string) => (
                    <span key={tag} style={{ fontSize:10, background:'var(--bg2)', color:'var(--text3)', borderRadius:99, padding:'2px 8px', fontFamily:'var(--mono)' }}>
                      {tag.replace(/-/g,' ')}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'var(--text3)' }}>
                  {thumbs > 0   && <span>👍 {thumbs}</span>}
                  {bulb > 0     && <span>💡 {bulb}</span>}
                  {warning > 0  && <span>!️ {warning}</span>}
                  {comments > 0 && <span>💬 {comments}</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--text4)' }}>
                  {l.actual_end_date ? new Date(l.actual_end_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
