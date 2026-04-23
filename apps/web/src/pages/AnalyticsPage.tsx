import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'


async function fetchSnapshot() {
  const r = await api.get('/api/analytics/snapshot')
  return r.data
}

async function fetchResources() {
  const r = await api.get('/api/analytics/resources')
  return r.data
}

async function fetchLatest() {
  const r = await api.get('/api/analytics/insights/latest')
  return r.data
}

async function fetchHistory() {
  const r = await api.get('/api/analytics/insights/history')
  return r.data
}

async function fetchHistorical(id: string) {
  const r = await api.get(`/api/analytics/insights/${id}`)
  return r.data
}

const TAG_STYLES: Record<string, { bg: string, color: string }> = {
  'Supplier Risk':    { bg:'#FEF3C7', color:'#92400E' },
  'Resource':         { bg:'#EDE9FE', color:'#5B21B6' },
  'APQP':             { bg:'#E0F2FE', color:'#0369A1' },
  'Review Pattern':   { bg:'#FCE7F3', color:'#9D174D' },
  'Trend':            { bg:'#F0FDF4', color:'#166534' },
  'Data Quality':     { bg:'#F1F5F9', color:'#475569' },
  'PPAP':             { bg:'#F0FDF4', color:'#166534' },
}

const TYPE_STYLES: Record<string, { border: string, bg: string, iconColor: string }> = {
  alert:    { border:'#FCA5A5', bg:'#FEF2F2', iconColor:'var(--red)'   },
  warning:  { border:'#FDE68A', bg:'#FFFBEB', iconColor:'var(--amber)' },
  info:     { border:'#BAE6FD', bg:'#F0F9FF', iconColor:'#0369A1'      },
  positive: { border:'#86EFAC', bg:'#F0FDF4', iconColor:'var(--green)' },
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function LoadBadge({ overdue, projects }: { active: number, overdue: number, projects: number }) {
  if (projects >= 3 || overdue >= 5) return <span className="status red">Overloaded</span>
  if (projects >= 2 || overdue >= 2) return <span className="status amber">At Risk</span>
  return <span className="status green">Healthy</span>
}

export default function AnalyticsPage() {
  const qc = useQueryClient()

  const [generating, setGenerating]     = useState(false)
  const [genError, setGenError]         = useState('')
  const [currentInsight, setCurrentInsight] = useState<any>(null)
  const [showHistory, setShowHistory]   = useState(false)
  const [, setLoadingHistorical] = useState(false)

  const { data: snapshot, isLoading: snapLoading } = useQuery({ queryKey: ['analytics-snapshot'], queryFn: fetchSnapshot })
  const { data: resources, isLoading: resLoading } = useQuery({ queryKey: ['analytics-resources'], queryFn: fetchResources })
  const { data: latest }   = useQuery({ queryKey: ['analytics-latest'], queryFn: fetchLatest })
  const { data: history = [] } = useQuery({ queryKey: ['analytics-history'], queryFn: fetchHistory, enabled: showHistory })

  // Load latest on mount
  useEffect(() => { if (latest) setCurrentInsight(latest) }, [latest])

  async function handleGenerate() {
    setGenerating(true); setGenError('')
    try {
      const res = await api.post('/api/analytics/insights/generate', {})
      setCurrentInsight(res.data)
      qc.invalidateQueries({ queryKey: ['analytics-latest'] })
      qc.invalidateQueries({ queryKey: ['analytics-history'] })
    } catch(err: any) {
      setGenError(err?.response?.data?.error || 'Failed to generate insights')
    } finally { setGenerating(false) }
  }

  async function loadHistorical(id: string) {
    setLoadingHistorical(true)
    try {
      const data = await fetchHistorical(id)
      setCurrentInsight(data)
      setShowHistory(false)
    } finally { setLoadingHistorical(false) }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div className="page-title">Analytics Engine</div>
          <div className="page-sub">AI-generated insights across all projects, tasks, reviews and APQP</div>
        </div>
        <div style={{ fontSize:11, color:'var(--text3)', textAlign:'right' }}>
          Portfolio Manager view only
        </div>
      </div>

      {/* Section 1 — Portfolio Snapshot */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Portfolio Snapshot</div>
        {snapLoading ? (
          <div style={{ color:'var(--text3)', fontSize:13 }}>Loading...</div>
        ) : snapshot && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:12 }}>
            {[
              { label:'Active Projects',  value: snapshot.active_projects,  sub:'total active',          color:'var(--text)' },
              { label:'Portfolio OPV',    value: parseFloat(snapshot.avg_opv||0).toFixed(2), sub:'avg across active', color: parseFloat(snapshot.avg_opv||0) >= 0.8 ? 'var(--green)' : parseFloat(snapshot.avg_opv||0) >= 0.7 ? 'var(--amber)' : 'var(--red)' },
              { label:'On Track',         value: snapshot.on_track,          sub:'OPV ≥ 0.8',            color:'var(--green)' },
              { label:'Overdue Tasks',    value: snapshot.overdue_tasks,     sub:'across portfolio',      color: snapshot.overdue_tasks > 0 ? 'var(--red)' : 'var(--green)' },
              { label:'APQP Overdue',     value: snapshot.overdue_apqp,      sub:'elements past due',     color: snapshot.overdue_apqp > 0 ? 'var(--amber)' : 'var(--green)' },
              { label:'PPAP Overdue',     value: snapshot.overdue_ppap || 0,  sub:'elements not approved', color: (snapshot.overdue_ppap || 0) > 0 ? 'var(--red)' : 'var(--green)' },
              { label:'PPAP Rejected',    value: snapshot.rejected_ppap || 0, sub:'elements rejected',     color: (snapshot.rejected_ppap || 0) > 0 ? 'var(--red)' : 'var(--green)' },
            ].map(k => (
              <div key={k.label} className="kpi">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-val" style={{ color: k.color, fontSize:26 }}>{k.value}</div>
                <div className="kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2 — Resource Load */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Resource Load</div>
        {resLoading ? (
          <div style={{ color:'var(--text3)', fontSize:13 }}>Loading...</div>
        ) : resources && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
                  {['Name','Type','Projects','Active Tasks','Overdue','Load'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:600, color:'var(--text3)', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ...(resources.users || []).map((u: any) => ({ ...u, kind:'user', name: u.full_name, type: u.role })),
                  ...(resources.suppliers || []).map((s: any) => ({ ...s, kind:'supplier', name: s.supplier_name, type: s.supplier_type }))
                ].sort((a,b) => b.active_tasks - a.active_tasks).map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 14px', fontWeight:500, color:'var(--text)' }}>{r.name}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span className={`status ${r.kind === 'user' ? 'blue' : 'amber'}`} style={{ fontSize:11, textTransform:'capitalize' }}>
                        {r.kind === 'user' ? r.type?.replace('_',' ') : r.type}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, color:'var(--text2)' }}>{r.project_count}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, color:'var(--text2)' }}>{r.active_tasks}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, color: r.overdue_tasks > 0 ? 'var(--red)' : 'var(--text3)', fontWeight: r.overdue_tasks > 0 ? 600 : 400 }}>{r.overdue_tasks}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <LoadBadge active={parseInt(r.active_tasks)} overdue={parseInt(r.overdue_tasks)} projects={parseInt(r.project_count)} />
                    </td>
                  </tr>
                ))}
                {(!resources.users?.length && !resources.suppliers?.length) && (
                  <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text3)', fontSize:13 }}>No resource data available yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3 — AI Insights */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em' }}>AI Portfolio Insights</div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {currentInsight && (
              <button className="tb-btn" style={{ fontSize:12 }} onClick={() => { setShowHistory(true) }}>View History</button>
            )}
            <button className="tb-btn primary" onClick={handleGenerate} disabled={generating} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {generating ? 'Generating...' : currentInsight ? 'Regenerate' : 'Generate Insights'}
            </button>
          </div>
        </div>

        {genError && (
          <div style={{ background:'var(--red-bg)', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--red)', marginBottom:12 }}>{genError}</div>
        )}

        {generating && (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>Analysing your portfolio data...</div>
            <div style={{ fontSize:13, color:'var(--text3)' }}>Reading tasks, updates, reviews, APQP and slippage history. This takes 10-20 seconds.</div>
          </div>
        )}

        {!generating && !currentInsight && (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>No insights generated yet</div>
            <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20 }}>Click "Generate Insights" to analyse your full portfolio data and get AI-powered observations.</div>
            <button className="tb-btn primary" onClick={handleGenerate}>Generate Insights</button>
          </div>
        )}

        {!generating && currentInsight && (
          <div className="card" style={{ overflow:'hidden' }}>
            {/* Insights header */}
            <div style={{ background:'linear-gradient(135deg,#0C1B35,#1A3A6B)', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#60A5FA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span style={{ fontSize:13, fontWeight:600, color:'#fff' }}>AI Portfolio Insights</span>
                <span style={{ background:'rgba(0,196,140,0.15)', color:'#00C48C', border:'1px solid rgba(0,196,140,0.3)', borderRadius:99, padding:'2px 8px', fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>AI Generated</span>
              </div>
              <div style={{ fontSize:11, color:'#64748B' }}>
                {fmt(currentInsight.generated_at)} · {currentInsight.generated_by_name || 'Portfolio Manager'}
              </div>
            </div>

            <div style={{ padding:20 }}>
              {/* Data quality warnings */}
              {currentInsight.data_warnings?.length > 0 && (
                <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'12px 14px', display:'flex', gap:10, marginBottom:14 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#C2410C" stroke-width="1.5" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#C2410C" stroke-width="1.5" stroke-linecap="round"/></svg>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#9A3412', marginBottom:4 }}>Data Quality Notices</div>
                    {currentInsight.data_warnings.map((w: string, i: number) => (
                      <div key={i} style={{ fontSize:12, color:'#9A3412', lineHeight:1.6 }}>• {w}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights list */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {currentInsight.insights?.map((ins: any, i: number) => {
                  const ts = TYPE_STYLES[ins.type] || TYPE_STYLES.info
                  const tag = TAG_STYLES[ins.tag] || { bg:'#F1F5F9', color:'#475569' }
                  return (
                    <div key={i} style={{ border:`1px solid ${ts.border}`, background:ts.bg, borderRadius:8, padding:14, display:'flex', gap:12 }}>
                      <div style={{ width:30, height:30, borderRadius:7, background:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {ins.type === 'alert' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={ts.iconColor} stroke-width="1.5" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={ts.iconColor} stroke-width="1.5" stroke-linecap="round"/></svg>}
                        {ins.type === 'warning' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={ts.iconColor} stroke-width="1.5"/><path d="M12 7v5l3 3" stroke={ts.iconColor} stroke-width="1.5" stroke-linecap="round"/></svg>}
                        {ins.type === 'info' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={ts.iconColor} stroke-width="1.5"/><line x1="12" y1="8" x2="12" y2="12" stroke={ts.iconColor} stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r="0.5" fill={ts.iconColor} stroke={ts.iconColor}/></svg>}
                        {ins.type === 'positive' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={ts.iconColor} stroke-width="1.5" stroke-linecap="round"/><polyline points="22 4 12 14.01 9 11.01" stroke={ts.iconColor} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ marginBottom:6 }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, marginRight:8, textTransform:'uppercase', letterSpacing:'0.05em', background:tag.bg, color:tag.color }}>{ins.tag}</span>
                        </div>
                        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.65, marginBottom:4 }}>{ins.text}</div>
                        {ins.ref && <div style={{ fontSize:11, color:'var(--text3)' }}>{ins.ref}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize:11, color:'var(--text3)', marginTop:16, paddingTop:12, borderTop:'1px solid var(--border)', textAlign:'right' }}>
                AI Generated · {fmt(currentInsight.generated_at)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth:520, width:'95vw', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
            <div className="modal-header" style={{ flexShrink:0 }}>
              <div className="modal-title">Insight History</div>
              <button className="modal-close" onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign:'center', padding:32, color:'var(--text3)', fontSize:13 }}>No history yet</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {history.map((h: any) => (
                    <div key={h.id} onClick={() => loadHistorical(h.id)}
                      style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{fmt(h.generated_at)}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>by {h.generated_by_name || 'Portfolio Manager'}</div>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>
                        OPV: {parseFloat(h.snapshot?.avg_opv || 0).toFixed(2)} · {h.snapshot?.active} active
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
