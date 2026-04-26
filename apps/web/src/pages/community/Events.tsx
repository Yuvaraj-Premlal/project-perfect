import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityEvents, getCommunityMember } from '../../api/community'

const NAVY='#163B6D',NAVY_LIGHT='#EBF1FB',BORDER='#E2E8F0'
const TEXT='#0F172A',TEXT_MID='#334155',TEXT_LIGHT='#64748B',TEXT_FAINT='#94A3B8'
const GREEN='#059669',GREEN_BG='#ECFDF5',GREEN_BORDER='#A7F3D0'

interface Event {
  id:string;type:'deep_dive'|'roundtable';title:string;description:string;
  scheduled_at:string;duration_mins:number;max_attendees:number|null;
  is_recorded:boolean;rsvp_count:number;has_rsvp:boolean
}

export default function EventsPage() {
  const navigate = useNavigate()
  const member = getCommunityMember()
  const [events,setEvents] = useState<Event[]>([])
  const [loading,setLoading] = useState(true)
  const [rsvpQuestion,setRsvpQuestion] = useState<Record<string,string>>({})
  const [rsvping,setRsvping] = useState<string|null>(null)
  const [toast,setToast] = useState('')

  useEffect(()=>{if(!member){navigate('/community/login');return}loadEvents()},[])

  async function loadEvents(){
    setLoading(true)
    try{const res=await communityEvents.getAll();setEvents(res.data)}
    catch{showToast('Failed to load events')}
    finally{setLoading(false)}
  }

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),2800)}

  async function handleRsvp(event:Event){
    setRsvping(event.id)
    try{
      if(event.has_rsvp){
        await communityEvents.cancelRsvp(event.id)
        showToast('RSVP cancelled')
      } else {
        await communityEvents.rsvp(event.id,rsvpQuestion[event.id])
        showToast('RSVP confirmed — Yuvaraj will send you the link personally 24hrs before')
      }
      loadEvents()
    }catch{showToast('Failed to RSVP')}
    finally{setRsvping(null)}
  }

  const formatDate=(d:string)=>new Date(d).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const formatTime=(d:string)=>new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})

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
            <button key={i.p} onClick={()=>navigate(i.p)} style={{background:i.p==='/community/events'?'rgba(255,255,255,0.15)':'none',border:'none',color:'#fff',fontSize:12,fontFamily:'monospace',letterSpacing:'.05em',padding:'6px 11px',borderRadius:6,cursor:'pointer'}}>{i.l}</button>
          ))}
        </div>
        <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'#fff',fontFamily:'monospace',fontSize:10,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'1px solid rgba(255,255,255,0.25)',marginLeft:12}} onClick={()=>navigate('/community/profile')}>
          {member?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
        </div>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'1.5rem 1rem'}}>
        {/* HERO */}
        <div style={{background:NAVY,borderRadius:12,padding:'1.25rem 1.5rem',marginBottom:'1rem',color:'#fff'}}>
          <div style={{fontFamily:'monospace',fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:'.4rem'}}>Events · Project Perfect Community</div>
          <div style={{fontFamily:'serif',fontSize:24,fontWeight:500,color:'#fff',marginBottom:'.3rem'}}>Upcoming Sessions</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.65)'}}>Deep Dives hosted by Yuvaraj Premlal. Roundtables facilitated by Yuvaraj — 6–8 selected members per session.</div>
        </div>

        {/* EVENT CADENCE INFO */}
        <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1rem',marginBottom:'1rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
          <div>
            <div style={{fontFamily:'monospace',fontSize:9,color:NAVY,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.35rem',fontWeight:500}}>Month 1, 3, 5...</div>
            <div style={{fontSize:13,fontWeight:500,color:TEXT,marginBottom:2}}>Project Perfect Deep Dive</div>
            <div style={{fontSize:12,color:TEXT_LIGHT}}>Hosted by Yuvaraj · All members welcome · Recorded and shared</div>
          </div>
          <div>
            <div style={{fontFamily:'monospace',fontSize:9,color:NAVY,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.35rem',fontWeight:500}}>Month 2, 4, 6...</div>
            <div style={{fontSize:13,fontWeight:500,color:TEXT,marginBottom:2}}>Small Group Roundtable</div>
            <div style={{fontSize:12,color:TEXT_LIGHT}}>6–8 selected members · Not recorded · Anonymous summary shared</div>
          </div>
        </div>

        {/* EVENTS */}
        {loading?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>Loading events...</div>
        ):events.length===0?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT}}>
            <div style={{fontFamily:'serif',fontSize:18,marginBottom:'.5rem',color:TEXT_MID}}>No upcoming events yet</div>
            <div style={{fontFamily:'monospace',fontSize:11}}>Events are posted here when scheduled. Check back soon.</div>
          </div>
        ):events.map(event=>{
          const isDeepDive=event.type==='deep_dive'
          const date=new Date(event.scheduled_at)
          return(
            <div key={event.id} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1.1rem',marginBottom:'.75rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)',display:'flex',gap:'1rem',alignItems:'flex-start'}}>
              <div style={{background:NAVY,borderRadius:8,padding:'.5rem .75rem',textAlign:'center',minWidth:52,flexShrink:0}}>
                <div style={{fontFamily:'monospace',fontSize:22,fontWeight:500,color:'#fff',lineHeight:1}}>{date.getDate()}</div>
                <div style={{fontFamily:'monospace',fontSize:9,color:'rgba(255,255,255,0.6)',letterSpacing:'.06em'}}>{date.toLocaleString('en',{month:'short'}).toUpperCase()}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'monospace',fontSize:8,color:NAVY,background:NAVY_LIGHT,padding:'2px 8px',borderRadius:20,display:'inline-block',marginBottom:'.3rem',border:'1px solid rgba(22,59,109,0.15)',fontWeight:500,letterSpacing:'.06em',textTransform:'uppercase'}}>
                  {isDeepDive?'Project Perfect Deep Dive':'Small Group Roundtable'}
                </div>
                <div style={{fontFamily:'serif',fontSize:16,fontWeight:500,color:TEXT,marginBottom:'.3rem'}}>{event.title}</div>
                <div style={{fontSize:12.5,color:TEXT_LIGHT,lineHeight:1.6,marginBottom:'.6rem'}}>{event.description}</div>
                <div style={{display:'flex',alignItems:'center',gap:'.75rem',flexWrap:'wrap',marginBottom:'.75rem'}}>
                  <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>{formatDate(event.scheduled_at)}</span>
                  <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>{formatTime(event.scheduled_at)}</span>
                  <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>{event.duration_mins} min</span>
                  <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>{event.rsvp_count} attending</span>
                  {!isDeepDive&&<span style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}>Yuvaraj selects participants</span>}
                  {event.is_recorded&&<span style={{fontFamily:'monospace',fontSize:9,color:GREEN,background:GREEN_BG,padding:'1px 7px',borderRadius:20,border:`1px solid ${GREEN_BORDER}`}}>Recording shared</span>}
                </div>

                {/* Pre-session question for Deep Dive */}
                {isDeepDive&&!event.has_rsvp&&(
                  <input value={rsvpQuestion[event.id]||''} onChange={e=>setRsvpQuestion(p=>({...p,[event.id]:e.target.value}))} placeholder="Optional: What question do you want answered? (shared with Yuvaraj before the session)" style={{width:'100%',background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:TEXT,fontFamily:'inherit',outline:'none',marginBottom:'.65rem'}}/>
                )}

                <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
                  <button onClick={()=>handleRsvp(event)} disabled={rsvping===event.id} style={{
                    background:event.has_rsvp?GREEN_BG:NAVY,
                    border:event.has_rsvp?`1px solid ${GREEN_BORDER}`:'none',
                    color:event.has_rsvp?GREEN:'#fff',
                    fontFamily:'monospace',fontSize:9,letterSpacing:'.06em',
                    padding:'7px 14px',borderRadius:6,cursor:'pointer',
                    opacity:rsvping===event.id?.7:1
                  }}>
                    {rsvping===event.id?'...':(event.has_rsvp?'✓ RSVP\'d — Cancel':(isDeepDive?'RSVP →':'Express Interest →'))}
                  </button>
                  {event.has_rsvp&&<span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>Yuvaraj will send you the link personally 24hrs before.</span>}
                  {!isDeepDive&&!event.has_rsvp&&<span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>Yuvaraj will confirm selection personally.</span>}
                </div>
              </div>
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