import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityAdmin, communityApplications, communityApi, communityPlaybook, getCommunityMember } from '../../api/community'

const NAVY='#163B6D',NAVY_LIGHT='#EBF1FB',BORDER='#E2E8F0'
const TEXT='#0F172A',TEXT_MID='#334155',TEXT_LIGHT='#64748B',TEXT_FAINT='#94A3B8'
const GREEN='#059669',GREEN_BG='#ECFDF5',GREEN_BORDER='#A7F3D0'
const RED='#DC2626'
const AMBER='#D97706',AMBER_BG='#FFFBEB',AMBER_BORDER='#FCD34D'

interface DashboardData {
  active_members:number;posts_this_week:number;active_crises:number;playbook_entries:number;
  dormant_members:{id:string;name:string;email:string;last_login_at:string}[];
  most_active:{id:string;name:string;country:string;interactions:string}[]
}
interface Task {id:string;title:string;description:string;priority:string;status:string;trigger_type:string;member_name:string;member_email:string;created_at:string;snooze_until:string}
interface Application {id:string;name:string;email:string;role:string;company_name:string;company_sector:string;country:string;linkedin_url:string;qualifying_answer:string;status:string;admin_note:string;created_at:string}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const member = getCommunityMember()
  const [tab,setTab] = useState<'dashboard'|'tasks'|'saved'|'applications'|'members'>('dashboard')
  const [dashboard,setDashboard] = useState<DashboardData|null>(null)
  const [tasks,setTasks] = useState<Task[]>([])
  const [applications,setApplications] = useState<Application[]>([])
  const [members,setMembers] = useState<any[]>([])
  const [savedPosts,setSavedPosts] = useState<any[]>([])
  const [playbookForm,setPlaybookForm] = useState<{postId:string,category:string,note:string}|null>(null)
  const [addingToPlaybook,setAddingToPlaybook] = useState(false)
  const [appStatus,setAppStatus] = useState('pending')
  const [notes,setNotes] = useState<Record<string,string>>({})
  const [loading,setLoading] = useState(true)
  const [toast,setToast] = useState('')

  useEffect(()=>{
    if(!member?.is_admin){navigate('/community');return}
    loadData()
  },[tab,appStatus])

  async function loadData(){
    setLoading(true)
    try{
      if(tab==='dashboard'){const r=await communityAdmin.getDashboard();setDashboard(r.data)}
      else if(tab==='tasks'){const r=await communityAdmin.getTasks();setTasks(r.data)}
      else if(tab==='applications'){const r=await communityApplications.getAll(appStatus);setApplications(r.data)}
      else if(tab==='members'){const r=await communityApi.get('/community/admin/members/all');setMembers(r.data)}
      else if(tab==='saved'){
        const r=await communityApi.get('/community/posts?limit=50')
        const withSaves=r.data.filter((p:any)=>parseInt(p.save_count)>0)
        setSavedPosts(withSaves.sort((a:any,b:any)=>parseInt(b.save_count)-parseInt(a.save_count)))
      }
    }catch{showToast('Failed to load')}
    finally{setLoading(false)}
  }

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),3000)}

  async function handleTask(id:string,status:string){
    try{
      await communityAdmin.updateTask(id,{status,snooze_hours:status==='snoozed'?24:undefined})
      showToast(status==='done'?'Task marked done':'Snoozed 24 hours')
      loadData()
    }catch{showToast('Failed')}
  }

  const [inviteUrl, setInviteUrl] = useState('')

  const PLAYBOOK_CATEGORIES=[
    'supplier-risk','critical-path','review-culture','delay-cost',
    'launch-mgmt','quality-ppap','customer-delivery','team-resources',
    'tools-templates','scheduling'
  ]

  async function addToPlaybook(){
    if(!playbookForm||!playbookForm.category||!playbookForm.note){
      showToast('Please select a category and write a curator note');return
    }
    setAddingToPlaybook(true)
    try{
      await communityPlaybook.add({
        post_id:playbookForm.postId,
        category:playbookForm.category,
        curator_note:playbookForm.note
      })
      showToast('Added to Playbook successfully')
      setPlaybookForm(null)
      loadData()
    }catch(e:any){showToast('Failed: '+(e?.response?.data?.error||'Unknown error'))}
    finally{setAddingToPlaybook(false)}
  }

  async function handleApplication(id:string,status:string){
    try{
      if(status==='approved'){
        const inv=await communityApi.post(`/community/admin/applications/${id}/approve-and-invite`,{admin_note:notes[id]||''})
        setInviteUrl(inv.data.invite_url)
        try{ await navigator.clipboard.writeText(inv.data.invite_url) }catch(e){}
        showToast('Application approved — invite URL shown below, link copied to clipboard')
      } else {
        await communityApplications.update(id,{status,admin_note:notes[id]})
        showToast(`Application ${status}`)
      }
      loadData()
    }catch(e:any){
      console.error('handleApplication error:',e)
      showToast('Failed: '+( e?.response?.data?.error || e.message || 'Unknown error'))
    }
  }

  async function handleExport(){
    try{
      const res=await communityAdmin.exportMembers()
      const url=URL.createObjectURL(new Blob([res.data],{type:'text/csv'}))
      const a=document.createElement('a');a.href=url;a.download='pp-community-members.csv';a.click()
      showToast('Export downloaded')
    }catch{showToast('Export failed')}
  }

  const priorityColor=(p:string)=>p==='high'?RED:p==='medium'?AMBER:GREEN

  return(
    <div style={{minHeight:'100vh',background:'#F8FAFC'}}>
      {/* TOPBAR */}
      <div style={{background:'#0E2847',height:54,display:'flex',alignItems:'center',padding:'0 1.5rem',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 8px rgba(14,40,71,0.4)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>navigate('/community')}>
          <div style={{width:28,height:28,borderRadius:6,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'monospace',fontSize:11,fontWeight:500,color:'#fff',border:'1px solid rgba(255,255,255,0.2)'}}>PP</div>
          <span style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,0.55)',letterSpacing:'.08em'}}><span style={{color:'rgba(255,255,255,0.85)'}}>Project Perfect</span> Community · <span style={{color:'#93C5FD'}}>Admin</span></span>
        </div>
        <div style={{display:'flex',gap:2,marginLeft:'auto'}}>
          <button onClick={()=>navigate('/community')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.6)',fontFamily:'monospace',fontSize:11,padding:'6px 12px',borderRadius:6,cursor:'pointer'}}>← Back to Community</button>
        </div>
      </div>

      <div style={{maxWidth:980,margin:'0 auto',padding:'1.5rem 1rem'}}>
        {/* ADMIN TABS */}
        <div style={{display:'flex',gap:'.5rem',marginBottom:'1.25rem',flexWrap:'wrap'}}>
          {(['dashboard','tasks','saved','applications','members'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{fontFamily:'monospace',fontSize:10,letterSpacing:'.06em',textTransform:'uppercase',color:tab===t?'#fff':TEXT_LIGHT,background:tab===t?NAVY:'#fff',border:`1px solid ${tab===t?NAVY:BORDER}`,padding:'.5rem 1rem',borderRadius:6,cursor:'pointer'}}>
              {t==='applications'?`Applications`:t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
          <button onClick={handleExport} style={{marginLeft:'auto',fontFamily:'monospace',fontSize:10,letterSpacing:'.06em',color:TEXT_LIGHT,background:'#fff',border:`1px solid ${BORDER}`,padding:'.5rem 1rem',borderRadius:6,cursor:'pointer'}}>↓ Export CSV</button>
        </div>

        {inviteUrl&&(
          <div style={{background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:10,padding:'1rem',marginBottom:'1rem'}}>
            <div style={{fontFamily:'monospace',fontSize:9,color:'#059669',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.5rem',fontWeight:500}}>✓ Invite link generated — send this to the member personally</div>
            <div style={{background:'#fff',border:'1px solid #A7F3D0',borderRadius:6,padding:'.65rem .9rem',fontFamily:'monospace',fontSize:11,color:'#0F172A',wordBreak:'break-all',marginBottom:'.65rem'}}>{inviteUrl}</div>
            <div style={{display:'flex',gap:'.5rem'}}>
              <button onClick={()=>{navigator.clipboard.writeText(inviteUrl);showToast('Copied!')}} style={{background:'#059669',border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,padding:'7px 14px',borderRadius:6,cursor:'pointer'}}>Copy Link</button>
              <button onClick={()=>setInviteUrl('')} style={{background:'none',border:'1px solid #A7F3D0',color:'#059669',fontFamily:'monospace',fontSize:10,padding:'7px 14px',borderRadius:6,cursor:'pointer'}}>Dismiss</button>
            </div>
          </div>
        )}

        {loading?<div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>Loading...</div>:(
          <>
          {/* DASHBOARD TAB */}
          {tab==='dashboard'&&dashboard&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'.75rem',marginBottom:'1.25rem'}}>
                {[{n:dashboard.active_members,l:'Active members'},{n:dashboard.posts_this_week,l:'Posts this week'},{n:dashboard.active_crises,l:'Active crises'},{n:dashboard.playbook_entries,l:'Playbook entries'}].map(s=>(
                  <div key={s.l} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                    <div style={{fontFamily:'monospace',fontSize:30,fontWeight:500,color:NAVY,marginBottom:4}}>{s.n}</div>
                    <div style={{fontSize:12,color:TEXT_LIGHT}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem'}}>
                <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderLeft:`3px solid ${RED}`,borderRadius:10,padding:'1rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                  <div style={{fontFamily:'monospace',fontSize:9,color:RED,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.5rem',fontWeight:500}}>⚠ Dormancy Alert — 30+ days</div>
                  {dashboard.dormant_members.length===0?(
                    <div style={{fontSize:12,color:TEXT_FAINT,fontStyle:'italic'}}>No dormant members — great engagement!</div>
                  ):dashboard.dormant_members.map(m=>(
                    <div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'.3rem 0',borderBottom:`1px solid ${BORDER}`,fontSize:13,color:TEXT_MID}}>
                      <span>{m.name}</span>
                      <span style={{fontFamily:'monospace',fontSize:10,color:RED}}>{new Date(m.last_login_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderLeft:`3px solid ${GREEN}`,borderRadius:10,padding:'1rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                  <div style={{fontFamily:'monospace',fontSize:9,color:GREEN,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.5rem',fontWeight:500}}>Most Active This Week</div>
                  {dashboard.most_active.map(m=>(
                    <div key={m.id} style={{display:'flex',justifyContent:'space-between',padding:'.3rem 0',borderBottom:`1px solid ${BORDER}`,fontSize:13,color:TEXT_MID}}>
                      <span>{m.name} {m.country}</span>
                      <span style={{fontFamily:'monospace',fontSize:10,color:GREEN}}>{m.interactions} interactions</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TASKS TAB */}
          {tab==='tasks'&&(
            <>
              <div style={{background:NAVY_LIGHT,border:'1px solid rgba(22,59,109,0.15)',borderRadius:6,padding:'.65rem 1rem',marginBottom:'.85rem',fontSize:12,color:TEXT_MID}}>
                These tasks are created automatically by community events. <strong style={{color:NAVY}}>You write and send every message personally.</strong> Mark done when sent.
              </div>
              {tasks.length===0?(
                <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>No pending tasks — you're up to date.</div>
              ):tasks.map(task=>(
                <div key={task.id} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'.85rem 1rem',marginBottom:'.5rem',display:'flex',alignItems:'flex-start',gap:'.75rem',boxShadow:'0 1px 3px rgba(22,59,109,0.04)'}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:priorityColor(task.priority),flexShrink:0,marginTop:3}}></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:TEXT,marginBottom:2}}>{task.title}</div>
                    <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.03em'}}>
                      {task.member_email&&<span>{task.member_email} · </span>}
                      Created {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'.35rem',flexShrink:0}}>
                    <button onClick={()=>handleTask(task.id,'done')} style={{background:GREEN_BG,border:`1px solid ${GREEN_BORDER}`,color:GREEN,fontFamily:'monospace',fontSize:9,padding:'5px 11px',borderRadius:20,cursor:'pointer'}}>✓ Done</button>
                    <button onClick={()=>handleTask(task.id,'snoozed')} style={{background:'#F1F5F9',border:`1px solid ${BORDER}`,color:TEXT_FAINT,fontFamily:'monospace',fontSize:9,padding:'5px 11px',borderRadius:20,cursor:'pointer'}}>⏸ 24hrs</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* SAVED POSTS TAB — PLAYBOOK CURATION */}
          {tab==='saved'&&(
            <>
              <div style={{background:NAVY_LIGHT,border:'1px solid rgba(22,59,109,0.15)',borderRadius:6,padding:'.65rem 1rem',marginBottom:'.85rem',fontSize:12,color:TEXT_MID}}>
                These are the most saved posts in the community. Select any post, choose a category, write your curator's note — and it appears in the Playbook immediately.
              </div>

              {playbookForm&&(
                <div style={{background:'#fff',border:`1px solid ${NAVY}`,borderRadius:10,padding:'1.1rem',marginBottom:'1rem',boxShadow:'0 2px 8px rgba(22,59,109,0.12)'}}>
                  <div style={{fontFamily:'monospace',fontSize:9,color:NAVY,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'.75rem',fontWeight:500}}>Add to Playbook</div>
                  <div style={{marginBottom:'.75rem'}}>
                    <label style={{display:'block',fontFamily:'monospace',fontSize:10,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.4rem'}}>Category</label>
                    <select value={playbookForm.category} onChange={e=>setPlaybookForm(p=>p?{...p,category:e.target.value}:null)}
                      style={{width:'100%',background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:6,padding:'9px 14px',fontSize:13,color:TEXT,fontFamily:'inherit',outline:'none'}}>
                      <option value="">Select category</option>
                      {PLAYBOOK_CATEGORIES.map(c=><option key={c} value={c}>{c.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')}</option>)}
                    </select>
                  </div>
                  <div style={{marginBottom:'.75rem'}}>
                    <label style={{display:'block',fontFamily:'monospace',fontSize:10,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.4rem'}}>Your curator's note — why does this matter?</label>
                    <textarea value={playbookForm.note} onChange={e=>setPlaybookForm(p=>p?{...p,note:e.target.value}:null)}
                      placeholder="e.g. This is the most actionable supplier risk signal I've seen in 25 years. Simple to implement, high sensitivity."
                      style={{width:'100%',minHeight:70,background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:6,padding:'.75rem .9rem',color:TEXT,fontSize:13,fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.6}}/>
                  </div>
                  <div style={{display:'flex',gap:'.5rem'}}>
                    <button onClick={addToPlaybook} disabled={addingToPlaybook} style={{background:NAVY,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,letterSpacing:'.08em',padding:'8px 18px',borderRadius:6,cursor:'pointer',opacity:addingToPlaybook?.7:1}}>
                      {addingToPlaybook?'Adding...':'Add to Playbook →'}
                    </button>
                    <button onClick={()=>setPlaybookForm(null)} style={{background:'none',border:`1px solid ${BORDER}`,color:TEXT_FAINT,fontFamily:'monospace',fontSize:10,padding:'8px 14px',borderRadius:6,cursor:'pointer'}}>Cancel</button>
                  </div>
                </div>
              )}

              {savedPosts.length===0?(
                <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>No saved posts yet. Members save posts using the ◈ button.</div>
              ):savedPosts.map((post:any)=>(
                <div key={post.id} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1rem',marginBottom:'.65rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.4rem'}}>
                        <span style={{fontFamily:'monospace',fontSize:8,color:NAVY,background:NAVY_LIGHT,padding:'2px 8px',borderRadius:20,fontWeight:500,textTransform:'uppercase'}}>{post.type}</span>
                        <span style={{fontFamily:'monospace',fontSize:9,color:GREEN,background:GREEN_BG,padding:'2px 8px',borderRadius:20,border:`1px solid ${GREEN_BORDER}`}}>◈ {post.save_count} saves</span>
                        <span style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}>{post.author_name} · {post.author_role}</span>
                      </div>
                      <div style={{fontSize:13,color:TEXT_MID,lineHeight:1.65}}>{post.body.substring(0,200)}{post.body.length>200?'...':''}</div>
                    </div>
                    <button onClick={()=>setPlaybookForm({postId:post.id,category:'',note:''})}
                      style={{background:NAVY,border:'none',color:'#fff',fontFamily:'monospace',fontSize:9,letterSpacing:'.06em',padding:'7px 14px',borderRadius:6,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
                      + Add to Playbook
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* MEMBERS TAB */}
          {tab==='members'&&(
            <>
              <div style={{display:'flex',gap:'.5rem',marginBottom:'1rem',flexWrap:'wrap'}}>
                {['active','pending','suspended','removed'].map(s=>(
                  <button key={s} onClick={()=>setAppStatus(s)} style={{fontFamily:'monospace',fontSize:10,letterSpacing:'.04em',textTransform:'uppercase',color:appStatus===s?'#fff':TEXT_LIGHT,background:appStatus===s?NAVY:'#fff',border:`1px solid ${appStatus===s?NAVY:BORDER}`,padding:'.45rem .85rem',borderRadius:6,cursor:'pointer'}}>
                    {s}
                  </button>
                ))}
              </div>
              {members.length===0?(
                <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>No {appStatus} members</div>
              ):members.map((m:any)=>(
                <div key={m.id} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1rem',marginBottom:'.65rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:'.85rem'}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:NAVY_LIGHT,color:NAVY,fontFamily:'monospace',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:'1px solid rgba(22,59,109,0.15)'}}>
                      {m.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:'serif',fontSize:15,fontWeight:500,color:TEXT,marginBottom:2}}>{m.name}</div>
                      <div style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT,letterSpacing:'.03em',marginBottom:'.5rem'}}>{m.role} · {m.company_name} · {m.country} · {m.email}</div>
                      <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
                        <span style={{fontFamily:'monospace',fontSize:9,color:NAVY,background:NAVY_LIGHT,padding:'2px 8px',borderRadius:20}}>{m.tier}</span>
                        <span style={{fontFamily:'monospace',fontSize:9,color:m.status==='active'?GREEN:AMBER,background:m.status==='active'?GREEN_BG:AMBER_BG,padding:'2px 8px',borderRadius:20}}>{m.status}</span>
                        <span style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}>Posts: {m.post_count} · Saves: {m.saves_received}</span>
                        {m.last_login_at&&<span style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}>Last login: {new Date(m.last_login_at).toLocaleDateString()}</span>}
                        {!m.last_login_at&&m.status==='pending'&&<span style={{fontFamily:'monospace',fontSize:9,color:AMBER}}>Awaiting first login</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'.35rem',flexShrink:0}}>
                      {m.status==='active'&&<button onClick={()=>communityAdmin.updateMember(m.id,{status:'suspended'}).then(()=>{showToast('Member suspended');loadData()})} style={{background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',fontFamily:'monospace',fontSize:9,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>Suspend</button>}
                      {m.status==='suspended'&&<button onClick={()=>communityAdmin.updateMember(m.id,{status:'active'}).then(()=>{showToast('Member reactivated');loadData()})} style={{background:GREEN_BG,border:`1px solid ${GREEN_BORDER}`,color:GREEN,fontFamily:'monospace',fontSize:9,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>Reactivate</button>}
                      {m.status==='pending'&&<button onClick={()=>communityAdmin.generateInvite(m.id).then(r=>{setInviteUrl(r.data.invite_url);showToast('Invite link generated')})} style={{background:NAVY_LIGHT,border:'1px solid rgba(22,59,109,0.2)',color:NAVY,fontFamily:'monospace',fontSize:9,padding:'4px 10px',borderRadius:20,cursor:'pointer'}}>Resend Invite</button>}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* APPLICATIONS TAB */}
          {tab==='applications'&&(
            <>
              <div style={{display:'flex',gap:'.5rem',marginBottom:'1rem'}}>
                {['pending','hold','approved','declined'].map(s=>(
                  <button key={s} onClick={()=>setAppStatus(s)} style={{fontFamily:'monospace',fontSize:10,letterSpacing:'.04em',textTransform:'uppercase',color:appStatus===s?'#fff':TEXT_LIGHT,background:appStatus===s?NAVY:'#fff',border:`1px solid ${appStatus===s?NAVY:BORDER}`,padding:'.45rem .85rem',borderRadius:6,cursor:'pointer'}}>
                    {s}
                  </button>
                ))}
              </div>
              {applications.length===0?(
                <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>No {appStatus} applications</div>
              ):applications.map(app=>(
                <div key={app.id} style={{background:'#fff',border:`1px solid ${app.status==='hold'?AMBER_BORDER:BORDER}`,borderLeft:app.status==='hold'?`3px solid ${AMBER}`:`1px solid ${BORDER}`,borderRadius:10,padding:'1.1rem',marginBottom:'.75rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:'.85rem',marginBottom:'.75rem'}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:NAVY_LIGHT,color:NAVY,fontFamily:'monospace',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:'1px solid rgba(22,59,109,0.15)'}}>
                      {app.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:'serif',fontSize:15,fontWeight:500,color:TEXT,marginBottom:2}}>{app.name}</div>
                      <div style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT,letterSpacing:'.03em'}}>{app.role} · {app.company_name} · {app.company_sector} · {app.country} · Applied {new Date(app.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{display:'flex',gap:'.5rem',flexShrink:0}}>
                      <a href={app.linkedin_url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:5,fontFamily:'monospace',fontSize:9,color:NAVY,background:NAVY_LIGHT,padding:'3px 9px',borderRadius:20,textDecoration:'none',border:'1px solid rgba(22,59,109,0.15)'}}>↗ LinkedIn</a>
                    </div>
                  </div>
                  <div style={{background:NAVY_LIGHT,border:'1px solid rgba(22,59,109,0.15)',borderLeft:`3px solid ${NAVY}`,borderRadius:'0 6px 6px 0',padding:'.85rem 1rem',margin:'.75rem 0'}}>
                    <div style={{fontFamily:'monospace',fontSize:9,color:NAVY,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.4rem',fontWeight:500}}>Qualifying answer</div>
                    <div style={{fontFamily:'serif',fontSize:13,color:TEXT_MID,lineHeight:1.65,fontStyle:'italic'}}>"{app.qualifying_answer}"</div>
                  </div>
                  <input value={notes[app.id]||app.admin_note||''} onChange={e=>setNotes(p=>({...p,[app.id]:e.target.value}))} placeholder="Private note — only you see this. e.g. Met at CII Pune, referred by Rajkumar..." style={{width:'100%',background:AMBER_BG,border:`1px solid ${AMBER_BORDER}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:TEXT,fontFamily:'inherit',outline:'none',marginBottom:'.75rem'}}/>
                  {appStatus==='pending'&&(
                    <div style={{display:'flex',gap:'.5rem'}}>
                      <button onClick={()=>handleApplication(app.id,'approved')} style={{background:GREEN,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,letterSpacing:'.06em',padding:'8px 16px',borderRadius:6,cursor:'pointer'}}>✓ Approve — Send Invite</button>
                      <button onClick={()=>handleApplication(app.id,'hold')} style={{background:AMBER_BG,border:`1px solid ${AMBER_BORDER}`,color:AMBER,fontFamily:'monospace',fontSize:10,letterSpacing:'.06em',padding:'8px 16px',borderRadius:6,cursor:'pointer'}}>⏸ Hold</button>
                      <button onClick={()=>handleApplication(app.id,'declined')} style={{background:'#F1F5F9',border:`1px solid ${BORDER}`,color:TEXT_LIGHT,fontFamily:'monospace',fontSize:10,letterSpacing:'.06em',padding:'8px 16px',borderRadius:6,cursor:'pointer'}}>✕ Decline</button>
                    </div>
                  )}
                  {appStatus==='hold'&&(
                    <div style={{display:'flex',gap:'.5rem'}}>
                      <button onClick={()=>handleApplication(app.id,'approved')} style={{background:GREEN,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,padding:'8px 16px',borderRadius:6,cursor:'pointer'}}>✓ Approve Now</button>
                      <button onClick={()=>handleApplication(app.id,'declined')} style={{background:'#F1F5F9',border:`1px solid ${BORDER}`,color:TEXT_LIGHT,fontFamily:'monospace',fontSize:10,padding:'8px 16px',borderRadius:6,cursor:'pointer'}}>✕ Decline</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          </>
        )}
      </div>

      {toast&&<div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:11,padding:'.65rem 1.25rem',borderRadius:6,zIndex:999,boxShadow:'0 4px 16px rgba(22,59,109,0.3)',maxWidth:400}}>{toast}</div>}
    </div>
  )
}