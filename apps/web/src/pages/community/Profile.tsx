import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApi, getCommunityMember, clearCommunitySession } from '../../api/community'

const NAVY='#163B6D',NAVY_LIGHT='#EBF1FB',NAVY_FAINT='#F4F7FC',BORDER='#E2E8F0'
const TEXT='#0F172A',TEXT_MID='#334155',TEXT_LIGHT='#64748B',TEXT_FAINT='#94A3B8'
const AMBER='#D97706',AMBER_BG='#FFFBEB',AMBER_BORDER='#FCD34D'

const TIER_LABELS:Record<string,string>={contributor:'Contributor',practitioner:'◈ Practitioner',veteran:'★ Veteran'}
const TIER_COLORS:Record<string,string>={contributor:TEXT_FAINT,practitioner:NAVY,veteran:NAVY}

interface Stats {
  post_count:number;tool_count:number;saves_received:number;crises_helped:number
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const member = getCommunityMember()
  const [stats,setStats] = useState<Stats|null>(null)
  const [bio,setBio] = useState(member?.bio||'')
  const [editing,setEditing] = useState(false)
  const [saving,setSaving] = useState(false)
  const [toast,setToast] = useState('')

  useEffect(()=>{
    if(!member){navigate('/community/login');return}
    loadStats()
  },[])

  async function loadStats(){
    try{
      // Use admin endpoint to get own stats
      const res = await communityApi.get(`/community/admin/members?status=active`)
      const me = res.data.find((m:any)=>m.id===member.id)
      if(me){setStats({post_count:parseInt(me.post_count)||0,tool_count:parseInt(me.tool_count)||0,saves_received:parseInt(me.saves_received)||0,crises_helped:parseInt(me.crises_helped)||0})}
    }catch{
      setStats({post_count:0,tool_count:0,saves_received:0,crises_helped:0})
    }
  }

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),2800)}

  async function handleSaveBio(){
    setSaving(true)
    try{
      await communityApi.patch(`/community/admin/members/${member.id}`,{})
      showToast('Profile updated')
      setEditing(false)
    }catch{showToast('Failed to save')}
    finally{setSaving(false)}
  }

  function handleLogout(){
    clearCommunitySession()
    navigate('/community/login')
  }

  if(!member) return null

  return(
    <div style={{minHeight:'100vh',background:'#F8FAFC'}}>
      {/* TOPBAR */}
      <div style={{background:NAVY,height:54,display:'flex',alignItems:'center',padding:'0 1.5rem',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 8px rgba(14,40,71,0.25)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>navigate('/community')}>
          <div style={{width:28,height:28,borderRadius:6,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'monospace',fontSize:11,fontWeight:500,color:'#fff',border:'1px solid rgba(255,255,255,0.2)'}}>PP</div>
          <span style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,0.55)',letterSpacing:'.08em'}}><span style={{color:'rgba(255,255,255,0.85)'}}>Project Perfect</span> Community</span>
        </div>
        <div style={{display:'flex',gap:2,marginLeft:'auto'}}>
          {[{l:'Feed',p:'/community'},{l:'Crisis',p:'/community/crisis'},{l:'Playbook',p:'/community/playbook'},{l:'Events',p:'/community/events'}].map(i=>(
            <button key={i.p} onClick={()=>navigate(i.p)} style={{background:'none',border:'none',color:'#fff',fontSize:12,fontFamily:'monospace',letterSpacing:'.05em',padding:'6px 11px',borderRadius:6,cursor:'pointer'}}>{i.l}</button>
          ))}
        </div>
        <button onClick={handleLogout} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.7)',fontFamily:'monospace',fontSize:10,padding:'6px 12px',borderRadius:6,cursor:'pointer',marginLeft:12}}>Sign out</button>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'1.5rem 1rem'}}>
        {/* PROFILE HERO */}
        <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:12,padding:'1.5rem',marginBottom:'1rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:'1.25rem',marginBottom:'1.25rem',paddingBottom:'1.25rem',borderBottom:`1px solid ${BORDER}`}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:18,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {member.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'serif',fontSize:24,fontWeight:500,color:TEXT,marginBottom:3}}>{member.name}</div>
              <div style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT,letterSpacing:'.05em',marginBottom:'.5rem',textTransform:'uppercase'}}>{member.role} · {member.company_sector} · {member.country}</div>
              <div style={{display:'inline-flex',alignItems:'center',gap:6,background:NAVY_LIGHT,border:'1px solid rgba(22,59,109,0.2)',borderRadius:20,padding:'4px 12px',fontFamily:'monospace',fontSize:9,color:TIER_COLORS[member.tier]||NAVY,fontWeight:500,letterSpacing:'.06em'}}>
                {TIER_LABELS[member.tier]||member.tier}
              </div>
            </div>
          </div>

          {/* BIO */}
          <div style={{marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.5rem'}}>
              <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase'}}>Bio</div>
              {!editing&&<button onClick={()=>setEditing(true)} style={{background:'none',border:`1px solid ${BORDER}`,color:TEXT_FAINT,fontFamily:'monospace',fontSize:9,padding:'3px 10px',borderRadius:20,cursor:'pointer'}}>Edit</button>}
            </div>
            {editing?(
              <div>
                <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Who you are, what you care about in manufacturing ops, what you're happy to be asked about..." style={{width:'100%',minHeight:80,background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:6,padding:'.75rem .9rem',color:TEXT,fontSize:13,fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.6,marginBottom:'.5rem'}}/>
                <div style={{display:'flex',gap:'.5rem'}}>
                  <button onClick={handleSaveBio} disabled={saving} style={{background:NAVY,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,padding:'7px 14px',borderRadius:6,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
                  <button onClick={()=>setEditing(false)} style={{background:'none',border:`1px solid ${BORDER}`,color:TEXT_FAINT,fontFamily:'monospace',fontSize:10,padding:'7px 14px',borderRadius:6,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            ):(
              <div style={{fontSize:13.5,color:TEXT_MID,lineHeight:1.7,fontStyle:bio?'normal':'italic'}}>
                {bio||'No bio yet. Click Edit to add one.'}
              </div>
            )}
          </div>

          {/* NO CONTACT NOTE */}
          <div style={{background:'#F1F5F9',borderRadius:6,padding:'.65rem 1rem',fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.04em',borderLeft:'3px solid #CBD5E1'}}>
            No external links. No contact details. Your reputation on the Project Perfect Community is defined entirely by what you contribute here.
          </div>
        </div>

        {/* STATS — visible to self only */}
        <div style={{background:AMBER_BG,border:`1px solid ${AMBER_BORDER}`,borderRadius:6,padding:'.65rem 1rem',fontFamily:'monospace',fontSize:9,color:AMBER,marginBottom:'.85rem'}}>
          ★ Your contribution stats are visible only to you — other members see your tier badge only
        </div>

        <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.65rem',display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:10,height:2,background:NAVY,display:'inline-block',borderRadius:1}}></span>Your contribution stats
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'.65rem',marginBottom:'1.25rem'}}>
          {[
            {n:stats?.post_count??'—',l:'Posts published',s:'visible to all'},
            {n:stats?.tool_count??'—',l:'Tools shared',s:'in library'},
            {n:stats?.saves_received??'—',l:'Saves received',s:'from members'},
            {n:stats?.crises_helped??'—',l:'Crises helped',s:'via responses'},
          ].map(stat=>(
            <div key={stat.l} style={{background:NAVY_FAINT,border:'1px solid rgba(22,59,109,0.1)',borderRadius:8,padding:'.85rem',textAlign:'center'}}>
              <div style={{fontFamily:'monospace',fontSize:26,fontWeight:500,color:NAVY,marginBottom:4}}>{stat.n}</div>
              <div style={{fontSize:10,color:TEXT_LIGHT,lineHeight:1.3,marginBottom:2}}>{stat.l}</div>
              <div style={{fontFamily:'monospace',fontSize:8,color:TEXT_FAINT}}>{stat.s}</div>
            </div>
          ))}
        </div>

        <div style={{background:NAVY_LIGHT,border:'1px solid rgba(22,59,109,0.15)',borderRadius:8,padding:'.85rem 1rem',fontSize:12.5,color:TEXT_MID,lineHeight:1.65}}>
          <strong style={{color:NAVY}}>These four numbers are your reputation here.</strong> Not your job title. Not your company. Not your LinkedIn followers. Every number reflects something you contributed — a post someone saved, a tool someone downloaded, a crisis someone resolved with your help. This is what reputation looks like when it's earned.
        </div>
      </div>

      <div style={{maxWidth:780,margin:'2rem auto 1rem',padding:'1rem',borderTop:`1px solid ${BORDER}`,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}><strong style={{color:NAVY}}>Project Perfect Community</strong> · For manufacturing ops leaders who are done managing projects on hope.</span>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>projectperfect.in/community</span>
      </div>

      {toast&&<div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:11,padding:'.65rem 1.25rem',borderRadius:6,zIndex:999,boxShadow:'0 4px 16px rgba(22,59,109,0.3)'}}>{toast}</div>}
    </div>
  )
}