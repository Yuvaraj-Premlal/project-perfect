import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityCrisis, communityPosts, getCommunityMember } from '../../api/community'

const NAVY='#163B6D',NAVY_LIGHT='#EBF1FB',BORDER='#E2E8F0',TEXT='#0F172A',TEXT_MID='#334155'
const TEXT_FAINT='#94A3B8',RED='#DC2626',RED_BG='#FEF2F2',RED_BORDER='#FECACA'

interface Crisis {
  id:string;body:string;is_resolved:boolean;expires_at:string;created_at:string;
  author_role:string;author_country:string;response_count:number
}
interface Comment {
  id:string;body:string;author_name:string;author_role:string;author_tier:string;created_at:string
}

export default function CrisisBoard() {
  const navigate = useNavigate()
  const member = getCommunityMember()
  const [crises,setCrises] = useState<Crisis[]>([])
  const [loading,setLoading] = useState(true)
  const [showCompose,setShowCompose] = useState(false)
  const [body,setBody] = useState('')
  const [posting,setPosting] = useState(false)
  const [openComments,setOpenComments] = useState<Record<string,Comment[]>>({})
  const [commentText,setCommentText] = useState<Record<string,string>>({})
  const [toast,setToast] = useState('')
  const [filter,setFilter] = useState<'active'|'resolved'>('active')

  useEffect(()=>{if(!member){navigate('/community/login');return}loadCrises()},[filter])

  async function loadCrises(){
    setLoading(true)
    try{
      const res = filter==='active' ? await communityCrisis.getActive() : await communityCrisis.getResolved()
      setCrises(res.data)
    }catch{showToast('Failed to load')}
    finally{setLoading(false)}
  }

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),2800)}

  async function handlePost(){
    const wc = body.trim().split(/\s+/).length
    if(wc<50){showToast('Minimum 50 words required — be specific about your crisis');return}
    setPosting(true)
    try{
      await communityPosts.create({type:'crisis',body,is_anonymous:true})
      setBody('');setShowCompose(false)
      showToast('Crisis posted anonymously')
      loadCrises()
    }catch{showToast('Failed to post')}
    finally{setPosting(false)}
  }

  async function loadComments(id:string){
    if(openComments[id]){setOpenComments(p=>{const n={...p};delete n[id];return n});return}
    try{const res=await communityPosts.getComments(id);setOpenComments(p=>({...p,[id]:res.data}))}
    catch{showToast('Failed to load responses')}
  }

  async function handleComment(id:string){
    const b=commentText[id]
    if(!b?.trim())return
    try{
      await communityPosts.addComment(id,b)
      setCommentText(p=>({...p,[id]:''}))
      const res=await communityPosts.getComments(id)
      setOpenComments(p=>({...p,[id]:res.data}))
    }catch{showToast('Failed to post response')}
  }

  async function handleResolve(id:string){
    try{await communityPosts.resolve(id);showToast('Crisis marked as resolved');loadCrises()}
    catch{showToast('Failed to resolve')}
  }

  const wc=body.trim()?body.trim().split(/\s+/).length:0

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
            <button key={i.p} onClick={()=>navigate(i.p)} style={{background:i.p==='/community/crisis'?'rgba(255,255,255,0.15)':'none',border:'none',color:'#fff',fontSize:12,fontFamily:'monospace',letterSpacing:'.05em',padding:'6px 11px',borderRadius:6,cursor:'pointer'}}>{i.l}</button>
          ))}
        </div>
        <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'#fff',fontFamily:'monospace',fontSize:10,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'1px solid rgba(255,255,255,0.25)',marginLeft:12}} onClick={()=>navigate('/community/profile')}>
          {member?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
        </div>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'1.5rem 1rem'}}>
        {/* HERO */}
        <div style={{background:`linear-gradient(135deg,${NAVY},#1E4D8C)`,borderRadius:12,padding:'1.5rem',marginBottom:'1rem',color:'#fff'}}>
          <div style={{fontFamily:'monospace',fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:'.4rem'}}>◉ Crisis Board</div>
          <div style={{fontFamily:'serif',fontSize:24,fontWeight:500,color:'#fff',marginBottom:'.35rem'}}>Live Operational Problems</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.65)',lineHeight:1.6,maxWidth:560}}>Post a specific crisis. Get peer responses from experienced ops leaders. No email alerts — members check in because this community is worth checking.</div>
          <div style={{marginTop:'.85rem',background:'rgba(255,255,255,0.08)',borderRadius:6,padding:'.65rem 1rem',fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,0.65)',border:'1px solid rgba(255,255,255,0.1)'}}>
            <span style={{color:'#93C5FD',fontWeight:500}}>Your identity:</span> Role and country shown. Name and company never revealed.
          </div>
        </div>

        {/* POST CRISIS BUTTON */}
        {!showCompose && (
          <button onClick={()=>setShowCompose(true)} style={{width:'100%',background:'#fff',border:`2px dashed ${RED_BORDER}`,borderRadius:10,padding:'1rem',cursor:'pointer',color:RED,fontFamily:'monospace',fontSize:11,letterSpacing:'.08em',marginBottom:'1rem'}}>
            + Post a Crisis Anonymously
          </button>
        )}

        {/* COMPOSE */}
        {showCompose && (
          <div style={{background:'#fff',border:`1px solid ${RED_BORDER}`,borderRadius:10,padding:'1.1rem',marginBottom:'1rem',boxShadow:'0 1px 3px rgba(220,38,38,0.08)'}}>
            <div style={{fontFamily:'monospace',fontSize:9,color:RED,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'.65rem',fontWeight:500}}>Post a Crisis Anonymously</div>
            <div style={{background:RED_BG,border:`1px solid ${RED_BORDER}`,borderRadius:6,padding:'.65rem .9rem',fontSize:12,color:TEXT_MID,marginBottom:'.75rem',lineHeight:1.55}}>
              Your post will appear as <strong style={{color:RED}}>"Anonymous Member · [Your Role] · [Country]"</strong> — your name and company are never shown.
            </div>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Describe the crisis: what happened, what's at stake, what you've already tried, what help you need..." style={{width:'100%',minHeight:100,background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:6,padding:'.75rem .9rem',color:TEXT,fontSize:13,fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.6,marginBottom:'.65rem'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:'monospace',fontSize:10,color:wc<50?RED:TEXT_FAINT}}>{wc} words {wc<50?'(minimum 50)':''}</span>
              <div style={{display:'flex',gap:'.5rem'}}>
                <button onClick={()=>{setShowCompose(false);setBody('')}} style={{background:'none',border:`1px solid ${BORDER}`,color:TEXT_FAINT,fontFamily:'monospace',fontSize:10,padding:'7px 14px',borderRadius:6,cursor:'pointer'}}>Cancel</button>
                <button onClick={handlePost} disabled={posting} style={{background:RED,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,letterSpacing:'.08em',padding:'7px 18px',borderRadius:6,cursor:'pointer',opacity:posting?.7:1}}>
                  {posting?'Posting...':'Post Anonymously →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FILTER */}
        <div style={{display:'flex',borderBottom:`2px solid ${BORDER}`,marginBottom:'.85rem'}}>
          {(['active','resolved'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{background:'none',border:'none',borderBottom:`2px solid ${filter===f?RED:'transparent'}`,color:filter===f?RED:TEXT_FAINT,fontFamily:'monospace',fontSize:10,letterSpacing:'.06em',padding:'.55rem .9rem',cursor:'pointer',marginBottom:-2,textTransform:'uppercase',fontWeight:filter===f?500:400}}>
              {f==='active'?`Active Crises (${crises.length})`:'Resolved'}
            </button>
          ))}
        </div>

        {/* CRISES */}
        {loading?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>Loading...</div>
        ):crises.length===0?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>
            {filter==='active'?'No active crises. The community is in good shape.':'No resolved crises yet.'}
          </div>
        ):crises.map(crisis=>{
          const comments=openComments[crisis.id]
          const daysLeft=crisis.expires_at?Math.ceil((new Date(crisis.expires_at).getTime()-Date.now())/(1000*60*60*24)):null
          return(
            <div key={crisis.id} style={{background:'#fff',border:`1px solid ${RED_BORDER}`,borderLeft:`3px solid ${RED}`,borderRadius:10,padding:'1.1rem',marginBottom:'.7rem',boxShadow:'0 1px 3px rgba(220,38,38,0.06)'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:'.75rem',marginBottom:'.8rem'}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'#F1F5F9',color:TEXT_FAINT,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>?</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'monospace',fontSize:11,color:TEXT_FAINT,letterSpacing:'.03em'}}>Anonymous Member · {crisis.author_role} · {crisis.author_country}</div>
                  <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,marginTop:2}}>{new Date(crisis.created_at).toLocaleDateString()}</div>
                </div>
                {daysLeft!==null&&!crisis.is_resolved&&(
                  <span style={{fontFamily:'monospace',fontSize:9,color:RED,background:RED_BG,padding:'3px 9px',borderRadius:20,border:`1px solid ${RED_BORDER}`,flexShrink:0}}>Expires in {daysLeft} days</span>
                )}
                {crisis.is_resolved&&(
                  <span style={{fontFamily:'monospace',fontSize:9,color:'#059669',background:'#ECFDF5',padding:'3px 9px',borderRadius:20,border:'1px solid #A7F3D0',flexShrink:0}}>✓ Resolved</span>
                )}
              </div>
              <div style={{display:'inline-flex',alignItems:'center',background:RED_BG,border:`1px solid ${RED_BORDER}`,color:RED,fontFamily:'monospace',fontSize:8,letterSpacing:'.08em',padding:'2px 9px',borderRadius:20,marginBottom:'.6rem',fontWeight:500}}>
                {crisis.is_resolved?'✓ RESOLVED':'◉ ACTIVE CRISIS'}
              </div>
              <div style={{fontSize:13.5,fontWeight:300,color:TEXT_MID,lineHeight:1.8,marginBottom:'.85rem'}}>{crisis.body}</div>
              <div style={{display:'flex',alignItems:'center',gap:2,borderTop:`1px solid ${BORDER}`,paddingTop:'.75rem'}}>
                <button onClick={()=>loadComments(crisis.id)} style={{background:'none',border:'none',color:TEXT_FAINT,fontFamily:'monospace',fontSize:10,padding:'5px 9px',borderRadius:6,cursor:'pointer'}}>
                  ◎ {crisis.response_count} {crisis.response_count===1?'response':'responses'}
                </button>
                <button onClick={()=>handleResolve(crisis.id)} style={{background:'none',border:'none',color:TEXT_FAINT,fontFamily:'monospace',fontSize:10,padding:'5px 9px',borderRadius:6,cursor:'pointer'}}>✦ This helped me too</button>
                {!crisis.is_resolved&&(
                  <button onClick={()=>handleResolve(crisis.id)} style={{marginLeft:'auto',background:'#ECFDF5',border:'1px solid #A7F3D0',color:'#059669',fontFamily:'monospace',fontSize:10,padding:'5px 12px',borderRadius:6,cursor:'pointer'}}>✓ Mark Resolved</button>
                )}
              </div>
              {comments&&(
                <div style={{marginTop:'.85rem',borderTop:`1px solid ${BORDER}`,paddingTop:'.85rem'}}>
                  {comments.map(c=>(
                    <div key={c.id} style={{display:'flex',gap:'.55rem',marginBottom:'.65rem'}}>
                      <div style={{width:26,height:26,borderRadius:'50%',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:9,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {c.author_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div style={{background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:'0 6px 6px 6px',padding:'.55rem .8rem',flex:1}}>
                        <div style={{fontFamily:'monospace',fontSize:9,color:NAVY,marginBottom:2,fontWeight:500}}>{c.author_name} · {c.author_role}</div>
                        <div style={{fontSize:12.5,color:TEXT_MID,lineHeight:1.6}}>{c.body}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:'.4rem',marginTop:'.5rem'}}>
                    <input value={commentText[crisis.id]||''} onChange={e=>setCommentText(p=>({...p,[crisis.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleComment(crisis.id)} placeholder="Share what you know..." style={{flex:1,background:'#fff',border:`1px solid ${BORDER}`,color:TEXT,fontSize:12,padding:'7px 10px',borderRadius:6,outline:'none',fontFamily:'inherit'}}/>
                    <button onClick={()=>handleComment(crisis.id)} style={{background:NAVY,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,padding:'7px 12px',borderRadius:6,cursor:'pointer'}}>→</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{maxWidth:780,margin:'2rem auto 1rem',padding:'1rem',borderTop:`1px solid ${BORDER}`,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}><strong style={{color:NAVY}}>Project Perfect Community</strong> · For manufacturing ops leaders who are done managing projects on hope.</span>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>projectperfect.in/community</span>
      </div>

      {toast&&<div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:11,padding:'.65rem 1.25rem',borderRadius:6,zIndex:999,boxShadow:'0 4px 16px rgba(22,59,109,0.3)'}}>{toast}</div>}
    </div>
  )
}