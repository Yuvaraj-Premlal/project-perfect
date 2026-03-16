import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getTasks, getReviews, getWeeklyReports, getPreReviewBrief, sendNudge, generateWeeklyReport } from '../api/projects'

const TABS = ['Overview', 'Tasks', 'Reviews', 'Reports'] as const
type Tab = typeof TABS[number]

const GRAD = 'linear-gradient(135deg, #0071C5, #00C7FD)'

function RiskBadge({ label }: { label: string }) {
  const map: Record<string, {bg:string,color:string,border:string,text:string}> = {
    high_risk:  { bg:'#FEF2F2', color:'#DC2626', border:'#FECACA', text:'High Risk' },
    moderate:   { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A', text:'Moderate' },
    monitoring: { bg:'#EFF6FF', color:'#0071C5', border:'#BFDBFE', text:'Monitoring' },
    on_track:   { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0', text:'On Track' },
    complete:   { bg:'#F8FAFC', color:'#64748b', border:'#E2E8F0', text:'Complete' },
  }
  const s = map[label] || map.on_track
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>{s.text}</span>
}

function MetricCard({ label, value, sub, highlight }: { label:string, value:string, sub?:string, highlight?:boolean }) {
  return (
    <div style={{ background: highlight ? GRAD : 'white', borderRadius:14, border: highlight ? 'none' : '1px solid #D0E2F0', padding:16 }}>
      <p style={{ fontSize:11, color: highlight ? 'rgba(255,255,255,0.7)' : '#4d88ad', margin:'0 0 4px', fontWeight:600 }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:800, fontFamily:'JetBrains Mono, monospace', color: highlight ? 'white' : '#0d2e47', margin:0 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color: highlight ? 'rgba(255,255,255,0.6)' : '#4d88ad', margin:'4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function OverviewTab({ project }: { project: any }) {
  const [brief, setBrief]     = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchBrief() {
    setLoading(true)
    try { const d = await getPreReviewBrief(project.project_id); setBrief(d.brief) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <MetricCard label="OPV" value={`${(parseFloat(project.opv)*100).toFixed(1)}%`} sub="Target ≥ 80%" highlight />
        <MetricCard label="LFV" value={`${(parseFloat(project.lfv)*100).toFixed(1)}%`} sub="Target ≤ 120%" />
        <MetricCard label="Momentum" value={`${parseFloat(project.momentum)>=0?'+':''}${(parseFloat(project.momentum)*100).toFixed(1)}%`} />
        <MetricCard label="ECD"
          value={project.ecd_algorithmic ? new Date(project.ecd_algorithmic).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'}
          sub={`Planned: ${new Date(project.planned_end_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`} />
      </div>

      <div style={{ background:'white', borderRadius:14, border:'1px solid #D0E2F0', padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:GRAD, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontWeight:700, color:'#0d2e47', fontSize:14 }}>AI Pre-Review Brief</span>
          </div>
          <button onClick={fetchBrief} disabled={loading}
            style={{ background:GRAD, color:'white', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:loading?0.6:1, fontFamily:'DM Sans, sans-serif' }}>
            {loading ? 'Generating...' : 'Generate Brief'}
          </button>
        </div>
        {brief
          ? <p style={{ color:'#1a4a6e', fontSize:13, lineHeight:1.7, margin:0 }}>{brief}</p>
          : <p style={{ color:'#7aaac8', fontSize:13, margin:0 }}>Click Generate Brief to get an AI summary before your review.</p>}
      </div>

      <div style={{ background:'white', borderRadius:14, border:'1px solid #D0E2F0', padding:20 }}>
        <h3 style={{ fontWeight:700, color:'#0d2e47', fontSize:14, margin:'0 0 12px' }}>Project Details</h3>
        <dl style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 24px', margin:0 }}>
          {[['Customer',project.customer_name],['Project Code',project.project_code],['Risk Tier',project.risk_tier],['Status',project.status],
            ['Start Date',new Date(project.start_date).toLocaleDateString('en-GB')],
            ['Planned End',new Date(project.planned_end_date).toLocaleDateString('en-GB')]
          ].map(([label,val]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #EAF1F8' }}>
              <dt style={{ color:'#4d88ad', fontSize:12 }}>{label}</dt>
              <dd style={{ color:'#0d2e47', fontSize:12, fontWeight:600, margin:0, textTransform:'capitalize' }}>{val||'—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function TasksTab({ projectId }: { projectId:string }) {
  const { data:tasks, isLoading } = useQuery({ queryKey:['tasks',projectId], queryFn:()=>getTasks(projectId) })
  const [nudging, setNudging]         = useState<string|null>(null)
  const [nudgeResult, setNudgeResult] = useState<Record<string,string>>({})

  async function handleNudge(taskId:string) {
    setNudging(taskId)
    try { const d = await sendNudge(projectId,taskId); setNudgeResult(p=>({...p,[taskId]:d.message})) }
    finally { setNudging(null) }
  }

  if (isLoading) return <p style={{ textAlign:'center', color:'#4d88ad', padding:32, fontSize:13 }}>Loading tasks...</p>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {tasks?.map((task:any) => (
        <div key={task.task_id} style={{ background:'white', borderRadius:14, border:'1px solid #D0E2F0', padding:16, position:'relative', overflow:'hidden' }}>
          {task.risk_label==='high_risk' && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#DC2626' }} />}
          {task.risk_label==='moderate'  && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'#D97706' }} />}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, paddingLeft:['high_risk','moderate'].includes(task.risk_label)?10:0 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                <span style={{ fontWeight:700, color:'#0d2e47', fontSize:13 }}>{task.task_name}</span>
                <RiskBadge label={task.risk_label} />
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 14px', fontSize:11, color:'#4d88ad' }}>
                <span>Type: <span style={{ color:'#1a4a6e', fontWeight:600, textTransform:'capitalize' }}>{task.control_type.replace('_',' ')}</span></span>
                <span>Due: <span style={{ color:'#1a4a6e', fontWeight:600 }}>{new Date(task.planned_end_date).toLocaleDateString('en-GB')}</span></span>
                {task.delay_days>0 && <span style={{ color:'#DC2626', fontWeight:700 }}>⚠ {task.delay_days} days delayed</span>}
                <span>Status: <span style={{ color:'#1a4a6e', fontWeight:600, textTransform:'capitalize' }}>{task.completion_status.replace('_',' ')}</span></span>
              </div>
              <p style={{ fontSize:11, color:'#7aaac8', marginTop:6, marginBottom:0 }}>{task.acceptance_criteria}</p>
              {nudgeResult[task.task_id] && (
                <div style={{ marginTop:10, background:'#EAF1F8', border:'1px solid #D0E2F0', borderRadius:8, padding:10, fontSize:12, color:'#0d2e47', lineHeight:1.6 }}>
                  {nudgeResult[task.task_id]}
                </div>
              )}
            </div>
            {task.delay_days>0 && task.completion_status!=='complete' && (
              <button onClick={()=>handleNudge(task.task_id)} disabled={nudging===task.task_id}
                style={{ background:'#FFFBEB', border:'1px solid #FDE68A', color:'#D97706', borderRadius:8, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0, opacity:nudging===task.task_id?0.6:1, fontFamily:'DM Sans, sans-serif' }}>
                {nudging===task.task_id?'...':'✉ Nudge'}
              </button>
            )}
          </div>
        </div>
      ))}
      {tasks?.length===0 && <p style={{ textAlign:'center', color:'#4d88ad', padding:48, fontSize:13 }}>No tasks yet.</p>}
    </div>
  )
}

function ReviewsTab({ projectId }: { projectId:string }) {
  const { data:reviews, isLoading } = useQuery({ queryKey:['reviews',projectId], queryFn:()=>getReviews(projectId) })
  if (isLoading) return <p style={{ textAlign:'center', color:'#4d88ad', padding:32, fontSize:13 }}>Loading reviews...</p>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {reviews?.map((r:any) => (
        <div key={r.review_id} style={{ background:'white', borderRadius:14, border:'1px solid #D0E2F0', padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontWeight:700, color:'#0d2e47', fontSize:14 }}>
              {new Date(r.review_date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {r.escalation_triggered && <span style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>Escalation</span>}
              <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#0071C5', fontWeight:700 }}>OPV {(parseFloat(r.opv_snapshot)*100).toFixed(1)}%</span>
            </div>
          </div>
          {[['Discussion',r.discussion_points],['Blockers',r.blockers],['Actions Agreed',r.actions_agreed]].map(([label,val])=>val?(
            <div key={label as string} style={{ marginBottom:10 }}>
              <span style={{ fontSize:10, color:'#7aaac8', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 }}>{label}</span>
              <p style={{ fontSize:13, color:'#1a4a6e', margin:'3px 0 0', lineHeight:1.6 }}>{val}</p>
            </div>
          ):null)}
          <p style={{ fontSize:11, color:'#7aaac8', margin:'10px 0 0' }}>By {r.conducted_by_name} · {new Date(r.created_at).toLocaleString('en-GB')}</p>
        </div>
      ))}
      {reviews?.length===0 && <p style={{ textAlign:'center', color:'#4d88ad', padding:48, fontSize:13 }}>No reviews yet.</p>}
    </div>
  )
}

function ReportsTab({ projectId }: { projectId:string }) {
  const queryClient = useQueryClient()
  const { data:reports, isLoading } = useQuery({ queryKey:['weekly-reports',projectId], queryFn:()=>getWeeklyReports(projectId) })
  const { mutate:generate, isPending } = useMutation({
    mutationFn: ()=>generateWeeklyReport(projectId),
    onSuccess:  ()=>queryClient.invalidateQueries({ queryKey:['weekly-reports',projectId] })
  })
  if (isLoading) return <p style={{ textAlign:'center', color:'#4d88ad', padding:32, fontSize:13 }}>Loading reports...</p>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={()=>generate()} disabled={isPending}
          style={{ background:GRAD, color:'white', border:'none', borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:isPending?0.6:1, fontFamily:'DM Sans, sans-serif' }}>
          {isPending?'Generating...':'Generate Weekly Report'}
        </button>
      </div>
      {reports?.map((r:any) => (
        <div key={r.report_id} style={{ background:'white', borderRadius:14, border:'1px solid #D0E2F0', padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontWeight:700, color:'#0d2e47', fontSize:14 }}>
              Week ending {new Date(r.week_ending).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
            </span>
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:12, color:'#0071C5', fontWeight:700 }}>OPV {(parseFloat(r.opv_snapshot)*100).toFixed(1)}%</span>
          </div>
          <p style={{ fontSize:13, color:'#1a4a6e', lineHeight:1.7, margin:0 }}>{r.report_content}</p>
          <p style={{ fontSize:11, color:'#7aaac8', margin:'10px 0 0' }}>{new Date(r.generated_at).toLocaleString('en-GB')}</p>
        </div>
      ))}
      {reports?.length===0 && <p style={{ textAlign:'center', color:'#4d88ad', padding:48, fontSize:13 }}>No reports yet.</p>}
    </div>
  )
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId:string }>()
  const navigate      = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  const { data:project, isLoading } = useQuery({ queryKey:['project',projectId], queryFn:()=>getProject(projectId!) })

  if (isLoading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f8fc' }}><p style={{ color:'#4d88ad', fontSize:13 }}>Loading project...</p></div>
  if (!project)  return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f8fc' }}><p style={{ color:'#4d88ad', fontSize:13 }}>Project not found.</p></div>

  return (
    <div style={{ minHeight:'100vh', background:'#f5f8fc' }}>
      <header style={{ background:'white', borderBottom:'1px solid #D0E2F0', padding:'0 24px', height:56, display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={()=>navigate('/')}
          style={{ color:'#4d88ad', fontSize:13, background:'none', border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', display:'flex', alignItems:'center', gap:4 }}>
          ← Dashboard
        </button>
        <span style={{ color:'#D0E2F0' }}>|</span>
        <div style={{ width:22, height:22, borderRadius:6, background:GRAD, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
            <path d="M3 9L7 13L15 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ fontWeight:700, color:'#0d2e47', fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project.project_name}</span>
        <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, flexShrink:0,
          background:project.risk_tier==='high'?'#FEF2F2':project.risk_tier==='moderate'?'#FFFBEB':'#ECFDF5',
          color:project.risk_tier==='high'?'#DC2626':project.risk_tier==='moderate'?'#D97706':'#059669',
          border:`1px solid ${project.risk_tier==='high'?'#FECACA':project.risk_tier==='moderate'?'#FDE68A':'#A7F3D0'}`
        }}>
          {project.risk_tier} risk
        </span>
      </header>

      <main style={{ maxWidth:900, margin:'0 auto', padding:'24px' }}>
        <div style={{ display:'flex', gap:4, background:'#EAF1F8', padding:4, borderRadius:12, width:'fit-content', marginBottom:20 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{ padding:'7px 18px', borderRadius:9, fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', transition:'all 0.15s',
                background:activeTab===tab?'white':'transparent',
                color:activeTab===tab?'#0071C5':'#4d88ad',
                boxShadow:activeTab===tab?'0 1px 4px rgba(0,113,197,0.12)':'none'
              }}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab==='Overview' && <OverviewTab project={project} />}
        {activeTab==='Tasks'    && <TasksTab projectId={projectId!} />}
        {activeTab==='Reviews'  && <ReviewsTab projectId={projectId!} />}
        {activeTab==='Reports'  && <ReportsTab projectId={projectId!} />}
      </main>
    </div>
  )
}
