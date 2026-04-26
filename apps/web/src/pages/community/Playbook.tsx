import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityPlaybook, getCommunityMember } from '../../api/community'

const NAVY='#163B6D',NAVY_LIGHT='#EBF1FB',NAVY_FAINT='#F4F7FC',BORDER='#E2E8F0'
const TEXT='#0F172A',TEXT_MID='#334155',TEXT_LIGHT='#64748B',TEXT_FAINT='#94A3B8'
const RED='#DC2626'

const CATEGORIES=[
  {id:'supplier-risk',label:'Supplier Risk',icon:'◎'},
  {id:'critical-path',label:'Critical Path',icon:'◈'},
  {id:'review-culture',label:'Review Culture',icon:'▤'},
  {id:'delay-cost',label:'Delay Cost',icon:'₹'},
  {id:'launch-mgmt',label:'Launch Management',icon:'⚡'},
  {id:'quality-ppap',label:'Quality & PPAP',icon:'⚙'},
  {id:'customer-delivery',label:'Customer & Delivery',icon:'◉'},
  {id:'team-resources',label:'Team & Resources',icon:'◇'},
  {id:'tools-templates',label:'Tools & Templates',icon:'□'},
  {id:'scheduling',label:'Execution & Scheduling',icon:'▶'},
]

const TIER_LABELS:Record<string,string>={contributor:'Contributor',practitioner:'Practitioner',veteran:'★ Veteran'}

interface Entry {
  id:string;category:string;curator_note:string;added_at:string;
  post_id:string;body:string;post_created_at:string;
  author_name:string;author_role:string;author_tier:string;save_count:number
}

export default function PlaybookPage() {
  const navigate = useNavigate()
  const member = getCommunityMember()
  const [entries,setEntries] = useState<Entry[]>([])
  const [loading,setLoading] = useState(true)
  const [category,setCategory] = useState('')
  const [search,setSearch] = useState('')
  const [searchInput,setSearchInput] = useState('')
  const [toast,setToast] = useState('')

  useEffect(()=>{if(!member){navigate('/community/login');return}loadPlaybook()},[category,search])

  async function loadPlaybook(){
    setLoading(true)
    try{const res=await communityPlaybook.getAll(category||undefined,search||undefined);setEntries(res.data)}
    catch{showToast('Failed to load Playbook')}
    finally{setLoading(false)}
  }

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),2800)}

  function handleSearch(e:React.FormEvent){e.preventDefault();setSearch(searchInput)}

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
            <button key={i.p} onClick={()=>navigate(i.p)} style={{background:i.p==='/community/playbook'?'rgba(255,255,255,0.15)':'none',border:'none',color:'#fff',fontSize:12,fontFamily:'monospace',letterSpacing:'.05em',padding:'6px 11px',borderRadius:6,cursor:'pointer'}}>{i.l}</button>
          ))}
        </div>
        <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'#fff',fontFamily:'monospace',fontSize:10,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'1px solid rgba(255,255,255,0.25)',marginLeft:12}} onClick={()=>navigate('/community/profile')}>
          {member?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'1.5rem 1rem'}}>
        {/* HERO */}
        <div style={{background:NAVY,borderRadius:12,padding:'1.5rem',marginBottom:'1rem',position:'relative',overflow:'hidden'}}>
          <div style={{fontFamily:'serif',fontSize:28,fontWeight:500,color:'#fff',marginBottom:'.4rem'}}>The Playbook</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.65)',lineHeight:1.65,maxWidth:520,marginBottom:'1rem'}}>Curated peer intelligence from the Project Perfect Community. Real insights from real ops leaders — saved by members, selected and annotated by Yuvaraj.</div>
          <form onSubmit={handleSearch} style={{display:'flex',gap:'.5rem',maxWidth:440}}>
            <div style={{flex:1,position:'relative'}}>
              <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.4)',fontSize:13}}>⌕</span>
              <input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Search by keyword — supplier delay, design freeze..." style={{width:'100%',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',padding:'9px 12px 9px 32px',fontSize:13,borderRadius:6,outline:'none'}}/>
            </div>
            <button type="submit" style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',fontFamily:'monospace',fontSize:10,padding:'9px 14px',borderRadius:6,cursor:'pointer'}}>Search</button>
            {search&&<button type="button" onClick={()=>{setSearch('');setSearchInput('')}} style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.6)',fontFamily:'monospace',fontSize:10,padding:'9px 12px',borderRadius:6,cursor:'pointer'}}>Clear</button>}
          </form>
        </div>

        {/* CATEGORIES */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'.5rem',marginBottom:'1rem'}}>
          <div onClick={()=>setCategory('')} style={{background:!category?NAVY_LIGHT:'#fff',border:`1px solid ${!category?'rgba(22,59,109,0.3)':BORDER}`,borderRadius:8,padding:'.65rem .75rem',cursor:'pointer',transition:'all .15s'}}>
            <div style={{fontFamily:'monospace',fontSize:8,color:NAVY,textTransform:'uppercase',marginBottom:'.3rem',fontWeight:500}}>◈ All</div>
            <div style={{fontSize:11,fontWeight:500,color:TEXT}}>All Entries</div>
            <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}>{entries.length} entries</div>
          </div>
          {CATEGORIES.slice(0,9).map(cat=>(
            <div key={cat.id} onClick={()=>setCategory(category===cat.id?'':cat.id)} style={{background:category===cat.id?NAVY_LIGHT:'#fff',border:`1px solid ${category===cat.id?'rgba(22,59,109,0.3)':BORDER}`,borderRadius:8,padding:'.65rem .75rem',cursor:'pointer',transition:'all .15s'}}>
              <div style={{fontFamily:'monospace',fontSize:8,color:NAVY,textTransform:'uppercase',marginBottom:'.3rem',fontWeight:500}}>{cat.icon} {cat.id.split('-')[0]}</div>
              <div style={{fontSize:11,fontWeight:500,color:TEXT}}>{cat.label}</div>
            </div>
          ))}
        </div>

        {/* ENTRIES */}
        <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.65rem',display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:10,height:2,background:NAVY,display:'inline-block',borderRadius:1}}></span>
          {search?`Search results for "${search}"`:category?CATEGORIES.find(c=>c.id===category)?.label+' entries':'All Playbook entries'} · {entries.length} {entries.length===1?'entry':'entries'}
        </div>

        {loading?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>Loading Playbook...</div>
        ):entries.length===0?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>
            {search?`No entries found for "${search}"`:'No Playbook entries yet. They appear here as the community grows.'}
          </div>
        ):entries.map((entry,idx)=>(
          <div key={entry.id} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1rem',marginBottom:'.6rem',display:'flex',gap:'1rem',alignItems:'flex-start',boxShadow:'0 1px 3px rgba(22,59,109,0.06)',transition:'all .15s',cursor:'pointer'}}
            onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(22,59,109,0.3)')}
            onMouseLeave={e=>(e.currentTarget.style.borderColor=BORDER)}>
            <div style={{fontFamily:'monospace',fontSize:26,fontWeight:500,color:NAVY_LIGHT,minWidth:32,lineHeight:1}}>{String(idx+1).padStart(2,'0')}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'monospace',fontSize:8,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.35rem',fontWeight:500,color:RED}}>
                {CATEGORIES.find(c=>c.id===entry.category)?.label||entry.category}
              </div>
              <div style={{fontFamily:'serif',fontSize:15,fontWeight:500,color:TEXT,marginBottom:'.3rem',lineHeight:1.4}}>{entry.body.split('.')[0]}.</div>
              <div style={{fontSize:12.5,color:TEXT_LIGHT,lineHeight:1.6,marginBottom:'.5rem'}}>{entry.body.substring(0,200)}{entry.body.length>200?'...':''}</div>
              <div style={{background:NAVY_FAINT,borderLeft:`2px solid ${NAVY}`,borderRadius:'0 6px 6px 0',padding:'.4rem .65rem',fontSize:11,color:NAVY,fontStyle:'italic',marginBottom:'.4rem'}}>
                "{entry.curator_note}" — Yuvaraj
              </div>
              <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap'}}>
                <span style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}>By <span style={{color:TEXT_MID}}>{entry.author_name}</span></span>
                <span style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT}}><span style={{color:TEXT_MID}}>{entry.save_count}</span> members saved</span>
                {entry.author_tier&&<span style={{fontFamily:'monospace',fontSize:8,color:NAVY,background:NAVY_LIGHT,padding:'1px 7px',borderRadius:20,border:`1px solid ${NAVY_LIGHT}`}}>{TIER_LABELS[entry.author_tier]}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{maxWidth:900,margin:'2rem auto 1rem',padding:'1rem',borderTop:`1px solid ${BORDER}`,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}><strong style={{color:NAVY}}>Project Perfect Community</strong> · For manufacturing ops leaders who are done managing projects on hope.</span>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>projectperfect.in/community</span>
      </div>

      {toast&&<div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:11,padding:'.65rem 1.25rem',borderRadius:6,zIndex:999,boxShadow:'0 4px 16px rgba(22,59,109,0.3)'}}>{toast}</div>}
    </div>
  )
}