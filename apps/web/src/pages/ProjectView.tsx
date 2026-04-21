import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getTasks, getWeeklyReports, getPreReviewBrief, generateWeeklyReport, closeProject, getClosureReport } from '../api/projects'
import { canEditProject } from '../api/auth'
import TasksTab from './TasksTab'
import ReviewsTab from './ReviewsTab'
import CharterTab from './CharterTab'
import APQPTab from './APQPTab'

const TABS = ['Summary','Tasks','Status Kanban','Weekly Kanban','Function Kanban','Reviews','Reports','Closure','Charter','APQP'] as const
type Tab = typeof TABS[number]


function KPIRow({ project, tasks }: { project:any, tasks:any[] }) {
  const opv  = parseFloat(project.opv)
  const lfv  = parseFloat(project.lfv)
  const mom  = parseFloat(project.momentum)
  const high = tasks.filter((t:any)=>t.risk_label==='high_risk').length
  return (
    <div className="kpi-row">
      <div className="kpi"><div className="kpi-label">OPV</div><div className={`kpi-val ${opv>=1?'green':opv>=0.8?'amber':'red'}`}>{opv.toFixed(2)}</div><div className="kpi-sub">Target &gt;= 0.8</div></div>
      <div className="kpi"><div className="kpi-label">LFV</div><div className={`kpi-val ${lfv<=1?'green':lfv<=1.2?'amber':'red'}`}>{lfv.toFixed(2)}</div><div className="kpi-sub">Target &lt;= 1.2</div></div>
      <div className="kpi"><div className="kpi-label">Momentum</div><div className={`kpi-val ${mom>=0?'green':'red'}`}>{mom>=0?'+':''}{mom.toFixed(2)}</div><div className="kpi-sub">vs last review</div></div>
      <div className="kpi"><div className="kpi-label">High Risk</div><div className={`kpi-val ${high===0?'green':high<=2?'amber':'red'}`}>{high}</div><div className="kpi-sub">tasks</div></div>
      <div className="kpi"><div className="kpi-label">ECD</div><div className="kpi-val navy" style={{ fontSize:14, marginTop:2 }}>{project.ecd_algorithmic ? new Date(project.ecd_algorithmic).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</div><div className="kpi-sub">Planned: {new Date(project.planned_end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
    </div>
  )
}

function RSPChart({ tasks, project }: { tasks:any[], project:any }) {
  const pStart = new Date(project.start_date)
  const today  = new Date()
  const allECDs = tasks.filter((t:any)=>t.current_ecd).map((t:any)=>new Date(t.current_ecd))
  const worstECD = allECDs.length > 0 ? new Date(Math.max(...allECDs.map((d:Date)=>d.getTime()))) : new Date(project.planned_end_date)
  const tEnd = new Date(worstECD); tEnd.setDate(tEnd.getDate()+14)
  const tot = tEnd.getTime() - pStart.getTime()
  function pct(d:string|Date){return Math.max(0,Math.min(100,(new Date(d).getTime()-pStart.getTime())/tot*100))}
  function fs(d:string|Date){return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
  function dd(a:string,b:string){return Math.max(0,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000))}
  const groups = [
    {label:'Sub-supplier',color:'var(--red)',  tasks:tasks.filter((t:any)=>t.control_type==='sub_supplier')},
    {label:'Supplier',    color:'var(--amber)', tasks:tasks.filter((t:any)=>t.control_type==='supplier')},
    {label:'Internal',    color:'var(--blue)',  tasks:tasks.filter((t:any)=>t.control_type==='internal')},
  ].filter(g=>g.tasks.length>0)
  const todayPct = pct(today)
  // Build months
  const months:any[] = []
  let cur = new Date(pStart)
  while(cur < tEnd) {
    const ms = new Date(cur), me = new Date(cur.getFullYear(),cur.getMonth()+1,1)
    const se = me < tEnd ? me : tEnd
    months.push({label:cur.toLocaleDateString('en-GB',{month:'short'}),w:(se.getTime()-ms.getTime())/tot*100})
    cur = me
  }
  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ minWidth:400 }}>
        <div style={{ display:'flex', marginLeft:165, marginBottom:4 }}>
          {months.map((m,i)=>(
            <div key={i} style={{ width:`${m.w}%`, fontSize:10, color:'var(--text3)', borderLeft:'1px solid var(--border)', paddingLeft:4, flexShrink:0 }}>{m.label}</div>
          ))}
        </div>
        {groups.map(g=>(
          <div key={g.label}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', padding:'6px 0 3px', borderBottom:'1px solid var(--border)', color:g.color }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:g.color }} />{g.label}
            </div>
            {[...g.tasks].sort((a:any,b:any)=>(b.risk_number||0)-(a.risk_number||0)).map((t:any)=>{
              const psP = pct(t.planned_start_date || project.start_date)
              const peP = pct(t.planned_end_date)
              const cdP = pct(t.current_ecd || t.planned_end_date)
              const delayDays = t.current_ecd ? dd(t.planned_end_date, t.current_ecd) : 0
              const isComplete = t.completion_status==='complete'
              const rn = t.risk_number||0
              return (
                <div key={t.task_id} style={{ display:'flex', alignItems:'center', marginBottom:4, minHeight:28 }}>
                  <div style={{ width:165, flexShrink:0, fontSize:11, color:'var(--text2)', paddingRight:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.task_name}>{t.task_name}</div>
                  <div style={{ flex:1, height:22, background:'var(--bg)', borderRadius:4, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, bottom:0, left:`${todayPct}%`, width:2, background:'var(--blue)', opacity:0.7, zIndex:5 }} />
                    {isComplete ? (
                      <div style={{ position:'absolute', top:1, height:20, left:`${psP}%`, width:`${Math.max(peP-psP,2)}%`, background:'var(--green-bg)', borderRadius:3, display:'flex', alignItems:'center', padding:'0 6px', gap:6, overflow:'hidden' }}>
                        <span style={{ fontSize:10, fontWeight:500, color:'var(--green)', whiteSpace:'nowrap' }}>{fs(t.planned_start_date||project.start_date)}</span>
                        <span style={{ fontSize:10, fontWeight:500, color:'var(--green)', marginLeft:'auto', whiteSpace:'nowrap' }}>{fs(t.planned_end_date)}</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ position:'absolute', top:1, height:20, left:`${psP}%`, width:`${Math.max(peP-psP,2)}%`, background:'var(--blue4)', borderRadius: cdP>peP?'3px 0 0 3px':'3px', display:'flex', alignItems:'center', padding:'0 6px', gap:4, overflow:'hidden' }}>
                          <span style={{ fontSize:10, fontWeight:500, color:'var(--navy)', whiteSpace:'nowrap', flexShrink:0 }}>{fs(t.planned_start_date||project.start_date)}</span>
                          <span style={{ fontSize:10, fontWeight:500, color:'var(--navy)', marginLeft:'auto', whiteSpace:'nowrap', flexShrink:0 }}>{fs(t.planned_end_date)}</span>
                        </div>
                        {cdP>peP && (
                          <div style={{ position:'absolute', top:1, height:20, left:`${peP}%`, width:`${Math.max(cdP-peP,2)}%`, background:'var(--red-bg)', borderRadius:'0 3px 3px 0', display:'flex', alignItems:'center', padding:'0 6px', overflow:'hidden' }}>
                            <span style={{ fontSize:10, fontWeight:500, color:'var(--red)', whiteSpace:'nowrap' }}>+{delayDays}d . {fs(t.current_ecd)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div style={{ width:38, flexShrink:0, textAlign:'right', fontFamily:'var(--mono)', fontSize:10, fontWeight:600, paddingLeft:6, color:rn===0?'var(--text4)':rn>=100?'var(--red)':rn>=50?'var(--amber)':'var(--blue)' }}>{rn||'-'}</div>
                </div>
              )
            })}
          </div>
        ))}
        {tasks.length===0 && <div style={{ textAlign:'center', padding:20, color:'var(--text4)', fontSize:12 }}>No tasks yet</div>}
        <div style={{ fontSize:10, color:'var(--text4)', marginTop:6, marginLeft:165 }}>Calendar extends to worst case ECD: {fs(worstECD)}</div>
      </div>
    </div>
  )
}

function SlippageChart({ tasks, project }: { tasks:any[], project:any }) {
  const groups = [
    {label:'Internal',     key:'internal',     color:'#B5D4F4', darkColor:'#378ADD', textColor:'#0C447C'},
    {label:'Supplier',     key:'supplier',     color:'#FAC775', darkColor:'#BA7517', textColor:'#633806'},
    {label:'Sub-supplier', key:'sub_supplier', color:'#F7C1C1', darkColor:'#E24B4A', textColor:'#791F1F'},
  ]
  // Use actual last review date from project, fallback to 7 days ago
  const lastReviewDate = project?.last_review_at ? new Date(project.last_review_at) : new Date(Date.now() - 7*24*60*60*1000)
  function allTimeSlips(key:string){return tasks.filter((t:any)=>t.control_type===key).reduce((s:number,t:any)=>s+(t.slippage_count||0),0)}
  // Since last review - tasks whose ECD was last updated after the last review date
  function recentSlips(key:string){return tasks.filter((t:any)=>t.control_type===key&&t.slippage_count>0&&t.last_update_at&&new Date(t.last_update_at)>lastReviewDate).reduce((s:number,t:any)=>s+(t.slippage_count||0),0)}
  const maxVal = Math.max(...groups.map(g=>allTimeSlips(g.key)),1)
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
        {groups.map(g=>(
          <div key={g.key} style={{ background:'var(--bg)', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:20, fontWeight:600, fontFamily:'var(--mono)', color:g.darkColor }}>{allTimeSlips(g.key)}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{g.label}</div>
            <div style={{ fontSize:10, color:'var(--text4)', marginTop:1 }}>+{recentSlips(g.key)} since last review</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {groups.map(g=>{
          const all = allTimeSlips(g.key)
          const recent = recentSlips(g.key)
          const allW = maxVal>0?Math.round(all/maxVal*100):0
          const recentW = maxVal>0?Math.round(recent/maxVal*100):0
          return (
            <div key={g.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:90, flexShrink:0, fontSize:11, color:'var(--text3)' }}>{g.label}</div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ height:14, width:`${allW}%`, minWidth:2, background:g.color, borderRadius:3 }} />
                  <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>{all}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ height:14, width:`${recentW}%`, minWidth: recent>0?2:0, background:g.darkColor, borderRadius:3 }} />
                  {recent>0&&<span style={{ fontSize:10, color:g.darkColor, fontFamily:'var(--mono)', fontWeight:600 }}>{recent}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:14, marginTop:10, fontSize:10, color:'var(--text3)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'var(--blue4)', display:'inline-block' }}/> All time</span>
        <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'var(--blue2)', display:'inline-block' }}/> Since last review</span>
      </div>
    </div>
  )
}

function SummaryTab({ project, tasks }: { project:any, tasks:any[] }) {
  const [brief, setBrief]     = useState<string|null>(null)
  const [briefLoading, setBL] = useState(false)
  const opv            = parseFloat(project.opv)
  const lfv            = parseFloat(project.lfv)
  const statusCls      = opv<0.8?'red':opv<0.9?'amber':opv>=1.0&&lfv<=1.0?'green':'blue'
  const statusText     = opv<0.8?'Out of control':opv<0.9?'High risk':opv>=1.0&&lfv<=1.0?'On track':'Monitoring'
  const completedTasks = tasks.filter((t:any)=>t.completion_status==='complete').length
  const progPct        = tasks.length ? Math.round(completedTasks/tasks.length*100) : 0
  // Completion range using TCR/DCR
  const tcr = parseFloat(project.tcr||'0')
  const dcr = parseFloat(project.dcr||'0')
  const externalDep = Math.round(((tcr+dcr)/2)*100)
  const depLabel = externalDep>=70?'High external dependency':externalDep>=40?'Moderate external dependency':'Low external dependency'
  const depColor = externalDep>=70?'var(--red)':externalDep>=40?'var(--amber)':'var(--green)'
  // Project completion chart data
  const pStart = project.start_date ? new Date(project.start_date) : null
  const pEnd   = project.planned_end_date ? new Date(project.planned_end_date) : null
  const ecd    = project.ecd_algorithmic ? new Date(project.ecd_algorithmic) : null
  const today  = new Date()
  function fs(d:Date|null){if(!d)return'-';return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}
  const delayDays = pEnd&&ecd?Math.max(0,Math.round((ecd.getTime()-pEnd.getTime())/86400000)):0
  async function genBrief() {
    setBL(true)
    try {
      const d = await getPreReviewBrief(project.project_id)
      setBrief(d.brief)
    } catch(err:any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate. Please try again.'
      setBrief('! ' + msg)
    } finally { setBL(false) }
  }
  // For project completion bar
  function barPct(d:Date|null, start:Date|null, end:Date|null){
    if(!d||!start||!end)return 0
    return Math.max(0,Math.min(100,(d.getTime()-start.getTime())/(end.getTime()-start.getTime())*100))
  }
  const chartEnd = ecd ? new Date(Math.max(ecd.getTime(), pEnd?.getTime()||0)) : pEnd
  const todayPct = chartEnd&&pStart ? barPct(today,pStart,new Date(chartEnd.getTime()+14*86400000)) : 0
  return (
    <div>
      <div className="two-col">
        <div>
          {/* Project details card */}
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">{project.project_name}</div><div className="card-sub">{project.risk_tier} risk . {project.customer_name}</div></div>
              <span className={`status ${statusCls}`}>{statusText}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div><div className="section-label">Timeline</div><div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.9 }}>Start: <span className="mono">{new Date(project.start_date).toLocaleDateString('en-GB')}</span><br/>Planned end: <span className="mono">{new Date(project.planned_end_date).toLocaleDateString('en-GB')}</span><br/>ECD: <span className="mono" style={{ color:'var(--red)' }}>{project.ecd_algorithmic ? new Date(project.ecd_algorithmic).toLocaleDateString('en-GB') : '-'}</span></div></div>
              <div><div className="section-label">Progress</div><div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.9 }}>{completedTasks} / {tasks.length} tasks complete<br/>PM: {project.pm_name || '-'}</div></div>
            </div>
            {/* Completion progress bar */}
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:5 }}><span>Completion progress</span><span>{progPct}%</span></div>
              <div style={{ background:'var(--bg2)', borderRadius:99, height:6 }}><div style={{ width:`${progPct}%`, height:6, borderRadius:99, background:'var(--blue2)', transition:'width 0.4s' }} /></div>
            </div>
          </div>

          {/* Slippage chart */}
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">Slippage by owner type</div><div className="card-sub">All time vs since last review . by control type</div></div>
            </div>
            <SlippageChart tasks={tasks} project={project} />
          </div>
        </div>

        <div>
          {/* AI Brief */}
          <div className="card">
            <div className="card-header">
              <div><div className="card-title" style={{ display:'flex', alignItems:'center', gap:8 }}><span className="ai-tag">AI</span> Project Quick Glance</div><div className="card-sub">Quick snapshot of project status</div></div>
              <button className="ai-btn" onClick={genBrief} disabled={briefLoading}>{briefLoading ? <><div className="ai-spinner" />&nbsp;Generating...</> : '* Generate'}</button>
            </div>
            {brief ? <div className="ai-panel"><div className="ai-panel-header">* AI Brief</div><div className="ai-panel-body">{brief}</div></div> : <div style={{ fontSize:11, color:'var(--text4)', textAlign:'center', padding:'18px 0' }}>Click Generate for a quick project glance</div>}
          </div>

          {/* Completion range */}
          {pStart && pEnd && (
            <div className="card">
              <div className="card-header"><div><div className="card-title">Completion range</div><div className="card-sub">Estimated during planning based on dependencies</div></div></div>
              <div style={{ fontSize:11, color:depColor, marginBottom:10 }}>{depLabel} . {externalDep}% external</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                {[
                  {label:'Baseline',color:'#B5D4F4',textColor:'#0C447C',end:pEnd},
                  {label:'Expected',color:'#F7C1C1',textColor:'#791F1F',end:ecd||pEnd},
                ].map((row)=>{
                  const endPct = chartEnd&&pStart ? barPct(row.end, pStart, new Date((chartEnd?.getTime()||0)+14*86400000)) : 0
                  return (
                    <div key={row.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:60, fontSize:10, color:'var(--text3)', flexShrink:0 }}>{row.label}</div>
                      <div style={{ flex:1, height:20, background:'var(--bg)', borderRadius:4, position:'relative' }}>
                        <div style={{ position:'absolute', top:-2, bottom:-2, left:`${todayPct}%`, width:2, background:'var(--blue)', opacity:0.8, zIndex:5 }} />
                        <div style={{ position:'absolute', top:1, height:18, left:'0%', width:`${endPct}%`, background:row.color, borderRadius:3, display:'flex', alignItems:'center', padding:'0 8px', gap:6, overflow:'hidden' }}>
                          <span style={{ fontSize:10, fontWeight:500, color:row.textColor, whiteSpace:'nowrap', flexShrink:0 }}>{fs(pStart)}</span>
                          <span style={{ fontSize:10, fontWeight:500, color:row.textColor, marginLeft:'auto', whiteSpace:'nowrap', flexShrink:0 }}>{fs(row.end)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
                {[
                  {label:'Planned end',val:fs(pEnd),color:'var(--green)'},
                  {label:'ECD',val:fs(ecd),color:'var(--red)'},
                  {label:'Total delay',val:delayDays>0?`+${delayDays}d`:'On time',color:delayDays>0?'var(--red)':'var(--green)'},
                ].map(s=>(
                  <div key={s.label} style={{ background:'var(--bg)', borderRadius:7, padding:'8px 10px' }}>
                    <div style={{ fontSize:12, fontWeight:600, fontFamily:'var(--mono)', color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  {label:'TCR - Task Chaos Ratio (Baseline)',val:tcr.toFixed(2),sub:`${Math.round(tcr*100)}% tasks external at baseline`},
                  {label:'DCR - Duration Chaos Ratio (Baseline)',val:dcr.toFixed(2),sub:`${Math.round(dcr*100)}% duration external at baseline`},
                ].map(s=>(
                  <div key={s.label} style={{ background:'var(--bg)', borderRadius:7, padding:'8px 10px' }}>
                    <div style={{ fontSize:15, fontWeight:600, fontFamily:'var(--mono)', color:externalDep>=70?'var(--red)':externalDep>=40?'var(--amber)':'var(--green)' }}>{s.val}</div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
                    <div style={{ fontSize:10, color:'var(--text4)', marginTop:1 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top risks */}
          <div className="card">
            <div className="card-header"><div><div className="card-title">Top risks by stakeholder</div><div className="card-sub">Highest RN per control type</div></div></div>
            {(['sub_supplier','supplier','internal'] as const).map(ct => {
              const ctTasks = tasks.filter((t:any)=>t.control_type===ct && (t.risk_number||0)>0)
              if (!ctTasks.length) return null
              const top   = [...ctTasks].sort((a:any,b:any)=>(b.risk_number||0)-(a.risk_number||0))[0]
              const label = ct==='sub_supplier'?'Sub-supplier':ct==='supplier'?'Supplier':'Internal'
              const cls   = ct==='sub_supplier'?'red':ct==='supplier'?'amber':'blue'
              return (
                <div key={ct} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <div><div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{top.task_name}</div><div style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{label} . {top.delay_days} days delayed</div></div>
                  <span className={`status ${cls}`}>RN {top.risk_number}</span>
                </div>
              )
            })}
            {tasks.every((t:any)=>(t.risk_number||0)===0) && <div style={{ fontSize:11, color:'var(--text4)', padding:'12px 0', textAlign:'center' }}>No risks identified yet</div>}
          </div>

          {/* Project details */}
          <div className="card">
            <div className="card-header"><div className="card-title">Project details</div></div>
            {[['Customer',project.customer_name],['Project Code',project.project_code],['Risk Tier',project.risk_tier],['Status',project.status],['Start',new Date(project.start_date).toLocaleDateString('en-GB')],['Planned End',new Date(project.planned_end_date).toLocaleDateString('en-GB')]].map(([label,val])=>(
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <span style={{ color:'var(--text3)' }}>{label}</span>
                <span style={{ color:'var(--text)', fontWeight:500, textTransform:'capitalize' }}>{val||'-'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RSP Chart - full width */}
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">RSP chart</div><div className="card-sub">Risk driven . Stakeholder wise . sorted by RN . calendar to worst ECD</div></div>
        </div>
        <div style={{ display:'flex', gap:14, fontSize:10, color:'var(--text3)', marginBottom:12 }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:8, borderRadius:2, background:'var(--blue4)', display:'inline-block' }}/> Planned</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:8, borderRadius:2, background:'var(--red-bg)', display:'inline-block' }}/> Delay</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:8, borderRadius:2, background:'var(--green-bg)', display:'inline-block' }}/> Complete</span>
        </div>
        <RSPChart tasks={tasks} project={project} />
      </div>
    </div>
  )
}

// ── Kanban card shared component ─────────────────────────────────
function KanbanCard({ t }: { t:any }) {
  const ecdDiffers = t.current_ecd && t.current_ecd !== t.planned_end_date
  return (
    <div className={`kanban-card ${t.delay_days>0?'overdue':''}`}>
      <div className="kanban-card-title">{t.task_name}</div>
      <div className="kanban-card-meta">
        <span style={{ textTransform:'capitalize' }}>{t.control_type.replace('_',' ')}</span>
        <span style={{ fontFamily:'var(--mono)', fontSize:10 }}>{new Date(t.planned_end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span>
      </div>
      {ecdDiffers && (
        <div style={{ fontSize:10, color:'var(--amber)', marginTop:4, fontFamily:'var(--mono)' }}>
          ECD: {new Date(t.current_ecd).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
        </div>
      )}
      {t.delay_days>0 && <div style={{ fontSize:10, color:'var(--red)', marginTop:3, fontFamily:'var(--mono)' }}>+{t.delay_days}d . RN {t.risk_number||0}</div>}
      {t.owner_department && <div style={{ fontSize:10, color:'var(--text4)', marginTop:3 }}>{t.owner_department}</div>}
    </div>
  )
}

// ── Status Kanban ─────────────────────────────────────────────────
function StatusKanban({ tasks }: { tasks:any[] }) {
  const cols = [
    {key:'not_started', label:'Not Started'},
    {key:'in_progress', label:'In Progress'},
    {key:'blocked',     label:'Blocked'},
    {key:'complete',    label:'Complete'},
  ]
  return (
    <div className="kanban-wrap" style={{ gridTemplateColumns:'repeat(4,minmax(0,1fr))' }}>
      {cols.map(col => (
        <div key={col.key} className="kanban-col">
          <div className="kanban-col-title">
            <span>{col.label}</span>
            <span style={{ background:'var(--bg2)', borderRadius:99, padding:'1px 7px', fontSize:10 }}>
              {tasks.filter((t:any)=>t.completion_status===col.key).length}
            </span>
          </div>
          {tasks.filter((t:any)=>t.completion_status===col.key).map((t:any) => (
            <KanbanCard key={t.task_id} t={t} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Weekly Kanban ─────────────────────────────────────────────────
function WeeklyKanban({ tasks }: { tasks:any[] }) {
  const incompleteTasks = tasks.filter((t:any) => t.completion_status !== 'complete')

  // Get week start (Monday) for a date
  function weekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0,0,0,0)
    return d
  }

  function weekEnd(start: Date): Date {
    const d = new Date(start)
    d.setDate(d.getDate() + 6)
    return d
  }

  function fmtShort(d: Date): string {
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' })
  }

  function weekNum(d: Date): number {
    const start = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  }

  // Find worst case ECD across all tasks
  const today = new Date(); today.setHours(0,0,0,0)
  const ecds = incompleteTasks
    .filter((t:any) => t.current_ecd)
    .map((t:any) => new Date(t.current_ecd))
  const worstECD = ecds.length > 0 ? new Date(Math.max(...ecds.map(d => d.getTime()))) : today

  // Build week columns from current week to worst ECD week
  const weeks: { start: Date; end: Date; label: string; key: string }[] = []
  let cursor = weekStart(today)
  const lastWeek = weekStart(worstECD)
  while (cursor <= lastWeek) {
    const end = weekEnd(cursor)
    weeks.push({
      start: new Date(cursor),
      end,
      label: `Week ${weekNum(cursor)} . ${fmtShort(cursor)} - ${fmtShort(end)}`,
      key: cursor.toISOString(),
    })
    cursor.setDate(cursor.getDate() + 7)
  }

  // Tasks with no ECD
  const unscheduled = incompleteTasks.filter((t:any) => !t.current_ecd)

  // Assign tasks to weeks
  function tasksForWeek(start: Date, end: Date) {
    return incompleteTasks.filter((t:any) => {
      if (!t.current_ecd) return false
      const ecd = new Date(t.current_ecd); ecd.setHours(0,0,0,0)
      return ecd >= start && ecd <= end
    })
  }

  const allCols = [...weeks, ...(unscheduled.length > 0 ? [{ start: new Date(0), end: new Date(0), label: 'Unscheduled', key: '__unscheduled__' }] : [])]

  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ display:'flex', gap:12, minWidth: `${allCols.length * 220}px`, alignItems:'flex-start' }}>
        {weeks.map(w => {
          const wTasks = tasksForWeek(w.start, w.end)
          return (
            <div key={w.key} className="kanban-col" style={{ minWidth:200, flex:'0 0 200px' }}>
              <div className="kanban-col-title">
                <span style={{ fontSize:10 }}>{w.label}</span>
                <span style={{ background:'var(--bg2)', borderRadius:99, padding:'1px 7px', fontSize:10 }}>{wTasks.length}</span>
              </div>
              {wTasks.map((t:any) => <KanbanCard key={t.task_id} t={t} />)}
              {wTasks.length === 0 && <div style={{ fontSize:11, color:'var(--text4)', padding:'12px 0', textAlign:'center' }}>No tasks</div>}
            </div>
          )
        })}
        {unscheduled.length > 0 && (
          <div className="kanban-col" style={{ minWidth:200, flex:'0 0 200px' }}>
            <div className="kanban-col-title">
              <span>Unscheduled</span>
              <span style={{ background:'var(--bg2)', borderRadius:99, padding:'1px 7px', fontSize:10 }}>{unscheduled.length}</span>
            </div>
            {unscheduled.map((t:any) => <KanbanCard key={t.task_id} t={t} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Function Kanban ───────────────────────────────────────────────
function FunctionKanban({ tasks }: { tasks:any[] }) {
  const incompleteTasks = tasks.filter((t:any) => t.completion_status !== 'complete')

  // Group by owner_department
  const deptMap: Record<string, any[]> = {}
  incompleteTasks.forEach((t:any) => {
    const dept = t.owner_department_name?.trim() || t.owner_department?.trim() || t.supplier_name?.trim() || '__unassigned__'
    if (!deptMap[dept]) deptMap[dept] = []
    deptMap[dept].push(t)
  })

  // Sort departments by task count descending, unassigned always last
  const depts = Object.entries(deptMap)
    .filter(([key]) => key !== '__unassigned__')
    .sort((a, b) => b[1].length - a[1].length)
    .map(([key, tasks]) => ({ label: key, tasks }))

  const unassigned = deptMap['__unassigned__'] || []
  const allCols = [...depts, ...(unassigned.length > 0 ? [{ label: 'Unassigned', tasks: unassigned }] : [])]

  if (allCols.length === 0) {
    return <div style={{ textAlign:'center', padding:40, color:'var(--text4)', fontSize:12 }}>No incomplete tasks.</div>
  }

  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ display:'flex', gap:12, minWidth: `${allCols.length * 220}px`, alignItems:'flex-start' }}>
        {allCols.map(col => (
          <div key={col.label} className="kanban-col" style={{ minWidth:200, flex:'0 0 200px' }}>
            <div className="kanban-col-title">
              <span>{col.label}</span>
              <span style={{ background:'var(--bg2)', borderRadius:99, padding:'1px 7px', fontSize:10 }}>{col.tasks.length}</span>
            </div>
            {col.tasks.map((t:any) => <KanbanCard key={t.task_id} t={t} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Lock Screen ───────────────────────────────────────────────────
function LockScreen({ flaggedTasks }: { flaggedTasks: any[] }) {
  const today = new Date().toISOString().split('T')[0]
  const fourDaysAgo = new Date(); fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
  const overdueECD  = flaggedTasks.filter(t => t.current_ecd && t.current_ecd < today)
  const staleUpdate = flaggedTasks.filter(t => !t.current_ecd || (t.last_update_at && new Date(t.last_update_at) < fourDaysAgo) || !t.last_update_at)
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:320 }}>
      <div style={{
        maxWidth:520, background:'var(--white)',
        border:'1px solid var(--border)', borderRadius:12,
        padding:'32px 36px', textAlign:'center',
      }}>
        <div style={{ fontSize:32, marginBottom:16 }}>🔒</div>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginBottom:10 }}>
          This tab is locked
        </div>
        <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, marginBottom:16 }}>
          {flaggedTasks.length} task{flaggedTasks.length !== 1 ? 's' : ''} require attention before you can access other tabs.
        </div>
        {overdueECD.length > 0 && (
          <div style={{ fontSize:12, color:'var(--red)', background:'var(--red-bg)', borderRadius:7, padding:'8px 14px', marginBottom:8, textAlign:'left' }}>
            <strong>{overdueECD.length} task{overdueECD.length !== 1 ? 's' : ''} with overdue ECD:</strong>{' '}
            {overdueECD.map(t => t.task_name).join(', ')}
          </div>
        )}
        {staleUpdate.length > 0 && (
          <div style={{ fontSize:12, color:'var(--amber)', background:'var(--amber-bg)', borderRadius:7, padding:'8px 14px', textAlign:'left' }}>
            <strong>{staleUpdate.length} task{staleUpdate.length !== 1 ? 's' : ''} with no update in 4+ days:</strong>{' '}
            {staleUpdate.map(t => t.task_name).join(', ')}
          </div>
        )}
        <div style={{ fontSize:11, color:'var(--text3)', marginTop:16 }}>
          Go to the Tasks tab, update the ECD or post an update for each flagged task to unlock.
        </div>
      </div>
    </div>
  )
}

function parseReportSections(content: string) {
  const sections = ['Executive Summary','Schedule Status','Schedule Slippages','Supplier Performance','Escalation Watch','Recommended Actions']
  const result: {heading:string, body:string}[] = []
  sections.forEach((s, i) => {
    const marker = `## ${s}`
    const nextMarker = i < sections.length-1 ? `## ${sections[i+1]}` : null
    const start = content.indexOf(marker)
    if (start === -1) return
    const bodyStart = start + marker.length
    const end = nextMarker ? content.indexOf(nextMarker) : content.length
    result.push({ heading: s, body: content.slice(bodyStart, end).trim() })
  })
  if (result.length === 0) result.push({ heading: '', body: content })
  return result
}

function printReport(report: any) {
  const win = window.open('', '_blank')
  if (!win) return
  const sections = parseReportSections(report.report_content || '')
  const date = new Date(report.week_ending).toLocaleDateString('en-GB', {day:'2-digit',month:'long',year:'numeric'})
  win.document.write(`<!DOCTYPE html><html><head><title>Weekly Report - ${date}</title>
  <style>
    body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#222;line-height:1.7}
    h1{font-size:22px;font-weight:600;margin-bottom:4px}
    .meta{font-size:13px;color:#666;margin-bottom:24px}
    h2{font-size:15px;font-weight:600;margin:20px 0 6px;padding-bottom:4px;border-bottom:1px solid #ddd;color:#1a1a2e}
    p{font-size:13px;margin:0 0 8px}
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0;background:#f5f5f5;padding:14px;border-radius:6px}
    .metric{text-align:center}.metric .val{font-size:18px;font-weight:600}.metric .lbl{font-size:11px;color:#666}
    @media print{body{margin:20px}}
  </style></head><body>
  <h1>Weekly Executive Report</h1>
  <div class="meta">Week ending ${date} &nbsp;.&nbsp; Generated ${new Date(report.created_at||Date.now()).toLocaleDateString('en-GB')}</div>
  <div class="metrics">
    <div class="metric"><div class="val">${(parseFloat(report.opv_snapshot||0)*100).toFixed(1)}%</div><div class="lbl">OPV</div></div>
    <div class="metric"><div class="val">${(parseFloat(report.lfv_snapshot||0)*100).toFixed(1)}%</div><div class="lbl">LFV</div></div>
    <div class="metric"><div class="val">${report.high_risk_count||0}</div><div class="lbl">High risk tasks</div></div>
  </div>
  ${sections.map(s => (s.heading ? '<h2>'+s.heading+'</h2>' : '') + '<p>' + s.body.split('\n').join('</p><p>') + '</p>').join('')}
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(()=>win.print(), 500)
}

function ReportsTab({ projectId, canEdit=true }: { projectId:string, canEdit?:boolean }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string|null>(null)
  const { data:reports=[], isLoading } = useQuery({ queryKey:['weekly-reports',projectId], queryFn:()=>getWeeklyReports(projectId) })
  const { mutate:generate, isPending, error:genError } = useMutation({
    mutationFn:()=>generateWeeklyReport(projectId),
    onSuccess:()=>qc.invalidateQueries({ queryKey:['weekly-reports',projectId] })
  })
  if (isLoading) return <div style={{ textAlign:'center', padding:40, color:'var(--text4)' }}>Loading...</div>
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Executive reports . 2 per week limit . stored for future retrieval</div>
        {canEdit && <button className="ai-btn" onClick={()=>generate()} disabled={isPending}>{isPending ? <><div className="ai-spinner"/>&nbsp;Generating...</> : '* Generate Weekly Report'}</button>}
      </div>
      {(genError as any)?.response?.status===429 && (
        <div className="alert-banner red" style={{ marginBottom:12 }}>! {(genError as any).response.data?.error || 'Weekly report limit reached. Try again next week.'}</div>
      )}
      {(reports as any[]).length===0 && <div style={{ textAlign:'center', padding:40, color:'var(--text4)', fontSize:12 }}>No reports yet.</div>}
      {(reports as any[]).map((r:any) => {
        const isOpen = expanded === r.report_id
        const sections = parseReportSections(r.report_content || '')
        return (
        <div key={r.report_id} className="card" style={{ marginBottom:12 }}>
          <div className="card-header" style={{ cursor:'pointer' }} onClick={()=>setExpanded(isOpen?null:r.report_id)}>
            <div>
              <div className="card-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color:'var(--text3)', transform:isOpen?'rotate(90deg)':'rotate(0deg)', transition:'transform 0.2s' }}>
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Week ending {new Date(r.week_ending).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
              </div>
              <div className="card-sub">OPV {(parseFloat(r.opv_snapshot)*100).toFixed(1)}% . LFV {(parseFloat(r.lfv_snapshot)*100).toFixed(1)}% . High risk: {r.high_risk_count}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {r.escalation_active && <span className="status red">Escalation Active</span>}
              <button className="tb-btn" style={{ fontSize:11 }} onClick={e=>{e.stopPropagation();printReport(r)}}>v PDF</button>
            </div>
          </div>
          {isOpen && (
            <div style={{ paddingTop:12, borderTop:'1px solid var(--border)' }}>
              {sections.map((s:any,i:number)=>(
                <div key={i} style={{ marginBottom:14 }}>
                  {s.heading && <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:6, paddingBottom:4, borderBottom:'1px solid var(--border)' }}>{s.heading}</div>}
                  <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.8 }}>{s.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

const SECTION_LABELS: Record<string,string> = {
  project_overview:        "Project Overview",
  key_events_timeline:     "Key Events Timeline",
  what_went_right:         "What Went Right",
  what_went_wrong:         "What Went Wrong",
  stakeholder_performance: "Stakeholder Performance",
  recommendations:         "Recommendations for Future Projects",
  pm_closing_remarks:      "PM Closing Remarks",
}

function ClosureTab({ project, tasks, canEdit=true }: { project:any, tasks:any[], canEdit?:boolean }) {
  const qc = useQueryClient()
  const [pmNotes, setPmNotes] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const { data:report, isLoading:reportLoading } = useQuery({
    queryKey: ["closure-report", project.project_id],
    queryFn:  () => getClosureReport(project.project_id),
    enabled:  project.status === "closed",
    retry:    false,
  })

  const incompleteTasks = tasks.filter((t:any) => t.completion_status !== "complete")

  async function handleClose() {
    setError(null)
    setSaving(true)
    try {
      await closeProject(project.project_id, { pm_notes: pmNotes, actual_end_date: date })
      qc.invalidateQueries({ queryKey: ["project", project.project_id] })
      qc.invalidateQueries({ queryKey: ["closure-report", project.project_id] })
    } catch(e:any) {
      setError(e?.response?.data?.error || "Failed to close project. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (project.status === "closed") {
    if (reportLoading) return (
      <div style={{ textAlign:"center", padding:60, color:"var(--text4)", fontSize:12 }}>Loading closure report...</div>
    )
    if (!report) return (
      <div className="card">
        <div className="card-header"><div className="card-title">Project Closed</div><span className="status green">Closed</span></div>
        <div style={{ fontSize:12, color:"var(--text4)", padding:"20px 0" }}>Closure report not found.</div>
      </div>
    )
    const sections = report.sections || {}
    const tags: string[] = report.tags || []
    const daysVariance: number = report.days_variance || 0
    const varianceText = daysVariance === 0 ? "Delivered on time" : daysVariance > 0 ? daysVariance + " days late" : Math.abs(daysVariance) + " days early"
    return (
      <div>
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Project Closure Case Study</div>
              <div className="card-sub">{varianceText} - {report.completed_tasks}/{report.total_tasks} tasks completed</div>
            </div>
            <span className="status green">Closed</span>
          </div>
          {tags.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12 }}>
              {tags.map((tag:string) => (
                <span key={tag} style={{ fontSize:10, background:"var(--bg2)", color:"var(--text3)", borderRadius:99, padding:"3px 10px", fontFamily:"var(--mono)" }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        {Object.entries(SECTION_LABELS).map(([key, label]) => {
          const text = sections[key]
          if (!text) return null
          const accent = key === "what_went_wrong" ? "var(--red)" : key === "what_went_right" ? "var(--green)" : key === "recommendations" ? "var(--blue)" : "var(--text3)"
          return (
            <div key={key} className="card" style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:accent, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>{label}</div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.85, whiteSpace:"pre-wrap" }}>{text}</div>
            </div>
          )
        })}
      </div>
    )
  }

  if (incompleteTasks.length > 0) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Cannot Close Project</div>
            <div className="card-sub">All tasks must be complete before closing</div>
          </div>
          <span className="status red">{incompleteTasks.length} incomplete</span>
        </div>
        <div style={{ marginTop:8 }}>
          {incompleteTasks.map((t:any) => (
            <div key={t.task_id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border)", fontSize:12 }}>
              <div style={{ color:"var(--text)", fontWeight:500 }}>{t.task_name}</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:11, color:"var(--text4)" }}>{t.phase_name || "Unassigned"}</span>
                <span className={`status ${t.control_type === "internal" ? "blue" : t.control_type === "supplier" ? "amber" : "red"}`} style={{ textTransform:"capitalize" }}>{(t.control_type || "").replace("_"," ")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="two-col">
      <div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Close Project</div>
              <div className="card-sub">All {tasks.length} tasks complete - ready to close</div>
            </div>
            <span className="status green">Ready</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14, marginTop:4 }}>
            <div className="form-group">
              <label className="form-label">Actual end date</label>
              <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Your observations and closing remarks</label>
              <textarea className="form-input" value={pmNotes} onChange={e=>setPmNotes(e.target.value)} rows={6} placeholder="Share your perspective on the project..." />
            </div>
            {error && (
              <div style={{ fontSize:12, color:"var(--red)", background:"var(--red-bg)", borderRadius:6, padding:"10px 14px" }}>{error}</div>
            )}
            {canEdit && <button className="tb-btn primary" onClick={handleClose} disabled={saving} style={{ width:"fit-content" }}>
              {saving ? "Generating case study..." : "Generate Closure Case Study"}
            </button>}
            <div style={{ fontSize:11, color:"var(--text4)" }}>This will permanently close the project and generate an AI case study from the full update history and lessons learnt.</div>
          </div>
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-header"><div className="card-title">What the AI will generate</div></div>
          {[
            ["Project Overview","Timeline, customer, delivery outcome"],
            ["Key Events Timeline","Significant moments drawn from update history"],
            ["What Went Right","Patterns of success across tasks and phases"],
            ["What Went Wrong","Root causes and systemic issues identified"],
            ["Stakeholder Performance","Supplier, sub-supplier and internal assessment"],
            ["Recommendations","Specific actions for future similar projects"],
            ["PM Closing Remarks","Your notes, preserved verbatim"],
          ].map(([title, sub]) => (
            <div key={title} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
              <div style={{ width:6, height:6, borderRadius:99, background:"var(--blue)", marginTop:5, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>{title}</div>
                <div style={{ fontSize:11, color:"var(--text4)", marginTop:2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProjectView({ projectId }: { projectId:string }) {
  const [activeTab, setActiveTab] = useState<Tab>('Summary')
  // Lifted review state - persists across tab switches
  const [reviewAgenda, setReviewAgenda]           = useState<any[]>([])
  const [reviewResponses, setReviewResponses]     = useState<Record<string,any>>({})
  const [reviewCustomPoints, setReviewCustomPoints] = useState<any[]>([])
  const [reviewAttendedBy, setReviewAttendedBy]   = useState('')

  const { data:project, isLoading, refetch:refetchProject } = useQuery({ queryKey:['project',projectId], queryFn:()=>getProject(projectId) })
  const { data:tasks=[], refetch:refetchTasks } = useQuery({ queryKey:['tasks',projectId], queryFn:()=>getTasks(projectId) })
  const { data: apqpElements = [] } = useQuery({ queryKey: ['apqp-elements', projectId], queryFn: async () => { const { api } = await import('../api/client'); const r = await api.get(`/api/apqp/projects/${projectId}/elements`); return r.data } })
  const hasApqp = (apqpElements as any[]).length > 0
  if (isLoading || !project) return <div style={{ textAlign:'center', padding:60, color:'var(--text4)' }}>Loading project...</div>

  // Compute flagged tasks - overdue ECD or stale update (4+ days)
  const today = new Date().toISOString().split('T')[0]
  const fourDaysAgo = new Date(); fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
  const flaggedTasks = (tasks as any[]).filter(t => {
    if (t.completion_status === 'complete') return false
    const ecdOverdue  = t.current_ecd && t.current_ecd < today
    const staleUpdate = !t.last_update_at || new Date(t.last_update_at) < fourDaysAgo
    return ecdOverdue || staleUpdate
  })
  const isLocked = flaggedTasks.length > 0
  const lockedTabs = ['Summary','Status Kanban','Weekly Kanban','Function Kanban','Reviews','Reports','Closure']
  const canEdit = canEditProject(project?.pm_user_id)

  return (
    <div>
      <KPIRow project={project} tasks={tasks as any[]} />
      <div className="tab-nav">
        {TABS.filter(tab => tab !== 'APQP' || hasApqp).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab===tab?'active':''}`}
            onClick={()=>setActiveTab(tab)}
            style={{ position:'relative' }}
          >
            {tab}
            {isLocked && lockedTabs.includes(tab) && (
              <span style={{ fontSize:9, marginLeft:4, opacity:0.6 }}>🔒</span>
            )}
          </button>
        ))}
      </div>
      {activeTab==='Summary'       && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <SummaryTab project={project} tasks={tasks as any[]} />)}
      {activeTab==='Tasks'         && <TasksTab projectId={projectId} project={project} tasks={tasks as any[]} refetch={()=>{ refetchTasks(); refetchProject(); }} canEdit={canEdit}  />}
      {activeTab==='Status Kanban' && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <StatusKanban tasks={tasks as any[]} />)}
      {activeTab==='Weekly Kanban' && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <WeeklyKanban tasks={tasks as any[]} />)}
      {activeTab==='Function Kanban' && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <FunctionKanban tasks={tasks as any[]} />)}
      {activeTab==='Reviews'       && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <ReviewsTab
        projectId={projectId}
        tasks={tasks as any[]}
        agenda={reviewAgenda}
        setAgenda={setReviewAgenda}
        responses={reviewResponses}
        setResponses={setReviewResponses}
        customPoints={reviewCustomPoints}
        setCustomPoints={setReviewCustomPoints}
        attendedBy={reviewAttendedBy}
        setAttendedBy={setReviewAttendedBy}
        canEdit={canEdit}
      />)}
      {activeTab==='Reports'       && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <ReportsTab projectId={projectId} canEdit={canEdit} />)}
      {activeTab==='Closure'       && (isLocked ? <LockScreen flaggedTasks={flaggedTasks} /> : <ClosureTab project={project} tasks={tasks as any[]} canEdit={canEdit} />)}
      {activeTab==='Charter'       && <CharterTab project={project} phases={project.phases || []} />}
      {activeTab==='APQP'          && <APQPTab projectId={projectId} canEdit={canEdit} />}
    </div>
  )
}
