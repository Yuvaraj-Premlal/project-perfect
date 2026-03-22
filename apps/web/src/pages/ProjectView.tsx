import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getTasks, getWeeklyReports, getPreReviewBrief, generateWeeklyReport } from '../api/projects'
import { api } from '../api/client'
import TasksTab from './TasksTab'
import ReviewsTab from './ReviewsTab'

interface ActionItem {
  key_issue: string
  action_agreed: string
  responsible: string
  due_date: string
}

function emptyAction(): ActionItem {
  return { key_issue: '', action_agreed: '', responsible: '', due_date: '' }
}

const TABS = ['Summary','Tasks','Kanban','Reviews','Reports','Closure'] as const
type Tab = typeof TABS[number]

function monoColor(val: number, good: number, bad: number, hib=true): string {
  if (hib) return val>=good?'var(--green)':val<=bad?'var(--red)':'var(--amber)'
  return val<=good?'var(--green)':val>=bad?'var(--red)':'var(--amber)'
}

function KPIRow({ project, tasks }: { project:any, tasks:any[] }) {
  const opv  = parseFloat(project.opv)
  const lfv  = parseFloat(project.lfv)
  const mom  = parseFloat(project.momentum)
  const vr   = opv / (lfv || 1)
  const high = tasks.filter((t:any)=>t.risk_label==='high_risk').length
  return (
    <div className="kpi-row">
      <div className="kpi"><div className="kpi-label">OPV</div><div className={`kpi-val ${opv>=1?'green':opv>=0.8?'amber':'red'}`}>{opv.toFixed(2)}</div><div className="kpi-sub">Target ≥ 0.8</div></div>
      <div className="kpi"><div className="kpi-label">LFV</div><div className={`kpi-val ${lfv<=1?'green':lfv<=1.2?'amber':'red'}`}>{lfv.toFixed(2)}</div><div className="kpi-sub">Target ≤ 1.2</div></div>
      <div className="kpi"><div className="kpi-label">VR</div><div className={`kpi-val ${vr>=0.9?'green':vr>=0.6?'amber':'red'}`}>{vr.toFixed(2)}</div><div className="kpi-sub">OPV ÷ LFV</div></div>
      <div className="kpi"><div className="kpi-label">Momentum</div><div className={`kpi-val ${mom>=0?'green':'red'}`}>{mom>=0?'+':''}{mom.toFixed(2)}</div><div className="kpi-sub">vs last review</div></div>
      <div className="kpi"><div className="kpi-label">High Risk</div><div className={`kpi-val ${high===0?'green':high<=2?'amber':'red'}`}>{high}</div><div className="kpi-sub">tasks</div></div>
      <div className="kpi"><div className="kpi-label">ECD</div><div className="kpi-val navy" style={{ fontSize:14, marginTop:2 }}>{project.ecd_algorithmic ? new Date(project.ecd_algorithmic).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—'}</div><div className="kpi-sub">Planned: {new Date(project.planned_end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</div></div>
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
  const groups = [
    { label:'Sub-supplier', color:'#C0392B', tasks: tasks.filter((t:any)=>t.control_type==='sub_supplier') },
    { label:'Supplier',     color:'#9A5A00', tasks: tasks.filter((t:any)=>t.control_type==='supplier') },
    { label:'Internal',     color:'#0068B5', tasks: tasks.filter((t:any)=>t.control_type==='internal') },
  ].filter(g=>g.tasks.length>0)
  async function genBrief() {
    setBL(true)
    try { const d = await getPreReviewBrief(project.project_id); setBrief(d.brief) }
    finally { setBL(false) }
  }
  return (
    <div>
      <div className="two-col">
        <div>
          <div className="card">
            <div className="card-header">
              <div><div className="card-title">{project.project_name}</div><div className="card-sub">{project.risk_tier} risk · {project.customer_name}</div></div>
              <span className={`status ${statusCls}`}>{statusText}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div><div className="section-label">Timeline</div><div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.9 }}>Start: <span className="mono">{new Date(project.start_date).toLocaleDateString('en-GB')}</span><br/>Planned end: <span className="mono">{new Date(project.planned_end_date).toLocaleDateString('en-GB')}</span><br/>ECD: <span className="mono" style={{ color:'var(--red)' }}>{project.ecd_algorithmic ? new Date(project.ecd_algorithmic).toLocaleDateString('en-GB') : '—'}</span></div></div>
              <div><div className="section-label">Progress</div><div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.9 }}>{completedTasks} / {tasks.length} tasks complete<br/>PM: {project.pm_name || '—'}</div></div>
            </div>
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:5 }}><span>Completion progress</span><span>{progPct}%</span></div>
              <div style={{ background:'var(--bg2)', borderRadius:99, height:6 }}><div style={{ width:`${progPct}%`, height:6, borderRadius:99, background:'var(--blue2)', transition:'width 0.4s' }} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div><div className="card-title">RSP Chart</div><div className="card-sub">Grouped by stakeholder · sorted by RN</div></div></div>
            {groups.map(g => (
              <div key={g.label}>
                <div className="rsp-group-header"><div style={{ width:8, height:8, borderRadius:'50%', background:g.color, flexShrink:0 }} /><span style={{ color:g.color }}>{g.label}</span></div>
                {[...g.tasks].sort((a:any,b:any)=>(b.risk_number||0)-(a.risk_number||0)).map((t:any) => {
                  const isComplete = t.completion_status==='complete'
                  const plannedW   = 60
                  const delayW     = Math.min(35, Math.round((t.delay_days||0)/30*40))
                  const rn         = t.risk_number || 0
                  return (
                    <div key={t.task_id} className="rsp-row">
                      <div className="rsp-label" title={t.task_name}>{t.task_name}</div>
                      <div className="rsp-track">
                        {isComplete ? (
                          <div style={{ position:'absolute',left:0,top:0,height:'100%',width:'70%',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:4,display:'flex',alignItems:'center',paddingLeft:7,fontSize:10,color:'var(--text4)' }}>Done</div>
                        ) : (
                          <>
                            <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${plannedW}%`,background:'var(--blue4)',borderRadius:'4px 0 0 4px',display:'flex',alignItems:'center',paddingLeft:7,fontSize:10,fontWeight:600,color:'var(--navy)' }}>{new Date(t.planned_end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</div>
                            {delayW > 0 && <div style={{ position:'absolute',left:`${plannedW}%`,top:0,height:'100%',width:`${delayW}%`,background:'var(--red-bg)',borderRadius:'0 4px 4px 0',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:6,fontSize:10,fontWeight:600,color:'var(--red)' }}>+{t.delay_days}d</div>}
                          </>
                        )}
                      </div>
                      <div className="rsp-rn" style={{ color:rn===0?'var(--text4)':rn>=100?'var(--red)':rn>=50?'var(--amber)':'var(--blue)' }}>{rn > 0 ? rn : '—'}</div>
                    </div>
                  )
                })}
              </div>
            ))}
            {tasks.length === 0 && <div style={{ textAlign:'center', padding:20, color:'var(--text4)', fontSize:12 }}>No tasks yet</div>}
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-header">
              <div><div className="card-title" style={{ display:'flex', alignItems:'center', gap:8 }}><span className="ai-tag">AI</span> Pre-Review Brief</div><div className="card-sub">AI summary before your review</div></div>
              <button className="ai-btn" onClick={genBrief} disabled={briefLoading}>{briefLoading ? <><div className="ai-spinner" />&nbsp;Generating...</> : '✦ Generate'}</button>
            </div>
            {brief ? <div className="ai-panel"><div className="ai-panel-header">✦ AI Brief</div><div className="ai-panel-body">{brief}</div></div> : <div style={{ fontSize:11, color:'var(--text4)', textAlign:'center', padding:'18px 0' }}>Click Generate to surface an AI pre-review brief</div>}
          </div>
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
                  <div><div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{top.task_name}</div><div style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{label} · {top.delay_days} days delayed</div></div>
                  <span className={`status ${cls}`}>RN {top.risk_number}</span>
                </div>
              )
            })}
            {tasks.every((t:any)=>(t.risk_number||0)===0) && <div style={{ fontSize:11, color:'var(--text4)', padding:'12px 0', textAlign:'center' }}>No risks identified yet</div>}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Project details</div></div>
            {[['Customer',project.customer_name],['Project Code',project.project_code],['Risk Tier',project.risk_tier],['Status',project.status],['Start',new Date(project.start_date).toLocaleDateString('en-GB')],['Planned End',new Date(project.planned_end_date).toLocaleDateString('en-GB')]].map(([label,val])=>(
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <span style={{ color:'var(--text3)' }}>{label}</span>
                <span style={{ color:'var(--text)', fontWeight:500, textTransform:'capitalize' }}>{val||'—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function KanbanTab({ tasks }: { tasks:any[] }) {
  const cols = [{key:'not_started',label:'Not Started'},{key:'in_progress',label:'In Progress'},{key:'blocked',label:'Blocked'},{key:'complete',label:'Complete'}]
  return (
    <div className="kanban-wrap" style={{ gridTemplateColumns:'repeat(4,minmax(0,1fr))' }}>
      {cols.map(col => (
        <div key={col.key} className="kanban-col">
          <div className="kanban-col-title"><span>{col.label}</span><span style={{ background:'var(--bg2)', borderRadius:99, padding:'1px 7px', fontSize:10 }}>{tasks.filter((t:any)=>t.completion_status===col.key).length}</span></div>
          {tasks.filter((t:any)=>t.completion_status===col.key).map((t:any) => (
            <div key={t.task_id} className={`kanban-card ${t.delay_days>0?'overdue':''}`}>
              <div className="kanban-card-title">{t.task_name}</div>
              <div className="kanban-card-meta"><span>{t.control_type.replace('_',' ')}</span><span>{new Date(t.planned_end_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span></div>
              {t.delay_days>0 && <div style={{ fontSize:10, color:'var(--red)', marginTop:5, fontFamily:'var(--mono)' }}>+{t.delay_days}d · RN {t.risk_number||0}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ReportsTab({ projectId }: { projectId:string }) {
  const qc = useQueryClient()
  const { data:reports=[], isLoading } = useQuery({ queryKey:['weekly-reports',projectId], queryFn:()=>getWeeklyReports(projectId) })
  const { mutate:generate, isPending } = useMutation({ mutationFn:()=>generateWeeklyReport(projectId), onSuccess:()=>qc.invalidateQueries({ queryKey:['weekly-reports',projectId] }) })
  if (isLoading) return <div style={{ textAlign:'center', padding:40, color:'var(--text4)' }}>Loading...</div>
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <button className="ai-btn" onClick={()=>generate()} disabled={isPending}>{isPending ? <><div className="ai-spinner"/>&nbsp;Generating...</> : '✦ Generate Weekly Report'}</button>
      </div>
      {(reports as any[]).length===0 && <div style={{ textAlign:'center', padding:40, color:'var(--text4)', fontSize:12 }}>No reports yet.</div>}
      {(reports as any[]).map((r:any) => (
        <div key={r.report_id} className="card">
          <div className="card-header"><div><div className="card-title">Week ending {new Date(r.week_ending).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div className="card-sub">{new Date(r.generated_at).toLocaleString('en-GB')}</div></div><span className="mono" style={{ color:'var(--blue)', fontWeight:600, fontSize:12 }}>OPV {(parseFloat(r.opv_snapshot)*100).toFixed(1)}%</span></div>
          <div className="ai-panel"><div className="ai-panel-header">✦ AI Weekly Narrative</div><div className="ai-panel-body">{r.report_content}</div></div>
        </div>
      ))}
    </div>
  )
}

function ClosureTab({ project }: { project:any }) {
  const qc = useQueryClient()
  const [notes, setNotes]   = useState('')
  const [date, setDate]     = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string|null>(project.closure_report||null)
  async function handleClose(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { const r = await api.post(`/api/projects/${project.project_id}/close`, { actual_end_date:date, closure_notes:notes }); setResult(r.data.closure_report); qc.invalidateQueries({ queryKey:['project',project.project_id] }) }
    finally { setSaving(false) }
  }
  if (project.status==='closed') return (
    <div className="card">
      <div className="card-header"><div className="card-title">Project closed</div><span className="status green">Closed</span></div>
      {result && <div className="ai-panel"><div className="ai-panel-header">✦ AI Closure Report</div><div className="ai-panel-body">{result}</div></div>}
      <div style={{ fontSize:12, color:'var(--text2)', marginTop:12 }}>Closed on {project.closed_at ? new Date(project.closed_at).toLocaleDateString('en-GB') : '—'}</div>
    </div>
  )
  return (
    <div className="two-col">
      <div>
        <div className="card">
          <div className="card-header"><div className="card-title">Close project</div></div>
          <form onSubmit={handleClose} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group"><label className="form-label">Actual end date</label><input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Lessons learnt / closure notes</label><textarea className="form-input" value={notes} onChange={e=>setNotes(e.target.value)} rows={5} placeholder="What were the key lessons?" /></div>
            <button type="submit" className="tb-btn primary" disabled={saving} style={{ width:'fit-content' }}>{saving ? 'Generating AI report...' : 'Close Project & Generate Report'}</button>
          </form>
          {result && <div className="ai-panel" style={{ marginTop:16 }}><div className="ai-panel-header">✦ AI Closure Report</div><div className="ai-panel-body">{result}</div></div>}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-header"><div className="card-title">Closure checklist</div></div>
          {['All tasks marked complete or formally deferred','Final review conducted and recorded','Lessons learnt captured','Customer sign-off obtained','Project documentation archived'].map((item,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
              <div style={{ width:16, height:16, borderRadius:4, border:'1.5px solid var(--border2)', flexShrink:0 }} />
              <span style={{ color:'var(--text2)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProjectView({ projectId }: { projectId:string }) {
  const [activeTab, setActiveTab] = useState<Tab>('Summary')
  // Lifted review state — persists across tab switches
  const [reviewAiSummary, setReviewAiSummary]     = useState('')
  const [reviewActionItems, setReviewActionItems] = useState<ActionItem[]>([emptyAction()])
  const [reviewAttendedBy, setReviewAttendedBy]   = useState('')
  const { data:project, isLoading } = useQuery({ queryKey:['project',projectId], queryFn:()=>getProject(projectId) })
  const { data:tasks=[], refetch:refetchTasks } = useQuery({ queryKey:['tasks',projectId], queryFn:()=>getTasks(projectId) })
  if (isLoading || !project) return <div style={{ textAlign:'center', padding:60, color:'var(--text4)' }}>Loading project...</div>
  return (
    <div>
      <KPIRow project={project} tasks={tasks as any[]} />
      <div className="tab-nav">
        {TABS.map(tab => (<button key={tab} className={`tab ${activeTab===tab?'active':''}`} onClick={()=>setActiveTab(tab)}>{tab}</button>))}
      </div>
      {activeTab==='Summary'  && <SummaryTab project={project} tasks={tasks as any[]} />}
      {activeTab==='Tasks'    && <TasksTab projectId={projectId} project={project} tasks={tasks as any[]} refetch={refetchTasks} />}
      {activeTab==='Kanban'   && <KanbanTab tasks={tasks as any[]} />}
      {activeTab==='Reviews'  && <ReviewsTab
        projectId={projectId}
        project={project}
        aiSummary={reviewAiSummary}
        setAiSummary={setReviewAiSummary}
        actionItems={reviewActionItems}
        setActionItems={setReviewActionItems}
        attendedBy={reviewAttendedBy}
        setAttendedBy={setReviewAttendedBy}
      />}
      {activeTab==='Reports'  && <ReportsTab projectId={projectId} />}
      {activeTab==='Closure'  && <ClosureTab project={project} />}
    </div>
  )
}
