import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityPosts, getCommunityMember } from '../../api/community'

const NAVY='#163B6D',NAVY_LIGHT='#EBF1FB',BORDER='#E2E8F0'
const TEXT='#0F172A',TEXT_MID='#334155',TEXT_LIGHT='#64748B',TEXT_FAINT='#94A3B8'
const GREEN='#059669',GREEN_BG='#ECFDF5',GREEN_BORDER='#A7F3D0'

interface Post {
  id:string;body:string;created_at:string;is_pinned:boolean;
  author_name:string;author_role:string;author_tier:string;save_count:number
}

const TIER_LABELS:Record<string,string>={contributor:'Contributor',practitioner:'Practitioner',veteran:'★ Veteran'}

export default function WeeklyQuestion() {
  const navigate = useNavigate()
  const member = getCommunityMember()
  const [questions,setQuestions] = useState<Post[]>([])
  const [answers,setAnswers] = useState<Post[]>([])
  const [loading,setLoading] = useState(true)
  const [answerBody,setAnswerBody] = useState('')
  const [posting,setPosting] = useState(false)
  const [saved,setSaved] = useState<Set<string>>(new Set())
  const [toast,setToast] = useState('')

  useEffect(()=>{if(!member){navigate('/community/login');return}loadQuestions()},[])

  async function loadQuestions(){
    setLoading(true)
    try{
      const res=await communityPosts.getFeed('question')
      const pinned=res.data.filter((p:Post)=>p.is_pinned)
      const all=res.data.filter((p:Post)=>!p.is_pinned)
      setQuestions(pinned)
      setAnswers(all)
    }catch{showToast('Failed to load')}
    finally{setLoading(false)}
  }

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(''),2800)}

  const currentQuestion=questions[0]
  const wc=answerBody.trim()?answerBody.trim().split(/\s+/).length:0

  async function handleAnswer(){
    if(wc<50){showToast('Minimum 50 words — be specific');return}
    if(wc>150){showToast('Maximum 150 words');return}
    setPosting(true)
    try{
      await communityPosts.create({type:'question',body:answerBody})
      setAnswerBody('')
      showToast('Answer posted — thank you for contributing')
      loadQuestions()
    }catch{showToast('Failed to post')}
    finally{setPosting(false)}
  }

  async function handleSave(id:string){
    try{
      if(saved.has(id)){await communityPosts.unsave(id);setSaved(p=>{const s=new Set(p);s.delete(id);return s});showToast('Removed from Playbook')}
      else{await communityPosts.save(id);setSaved(p=>new Set(p).add(id));showToast('◈ Saved to Playbook')}
    }catch{showToast('Failed to save')}
  }

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
        <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'#fff',fontFamily:'monospace',fontSize:10,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'1px solid rgba(255,255,255,0.25)',marginLeft:12}} onClick={()=>navigate('/community/profile')}>
          {member?.name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
        </div>
      </div>

      <div style={{maxWidth:780,margin:'0 auto',padding:'1.5rem 1rem'}}>
        {loading?(
          <div style={{textAlign:'center',padding:'3rem',color:TEXT_FAINT,fontFamily:'monospace',fontSize:12}}>Loading...</div>
        ):(
          <>
            {/* CURRENT QUESTION */}
            {currentQuestion?(
              <div style={{background:NAVY,borderRadius:12,padding:'1.5rem',marginBottom:'1rem',color:'#fff'}}>
                <div style={{fontFamily:'monospace',fontSize:9,color:'rgba(255,255,255,0.5)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:'.5rem'}}>★ Weekly Question · Posted by Yuvaraj Premlal</div>
                <div style={{fontFamily:'serif',fontSize:22,fontWeight:300,color:'#fff',lineHeight:1.4,marginBottom:'.75rem',fontStyle:'italic'}}>"{currentQuestion.body}"</div>
                <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(255,255,255,0.55)'}}>Never closes — answer any time · {answers.length} answers so far</div>
              </div>
            ):(
              <div style={{background:NAVY,borderRadius:12,padding:'1.5rem',marginBottom:'1rem',color:'#fff'}}>
                <div style={{fontFamily:'serif',fontSize:20,fontWeight:300,color:'rgba(255,255,255,0.7)',fontStyle:'italic'}}>This week's question will appear here every Monday.</div>
              </div>
            )}

            {/* ANSWER BOX */}
            {currentQuestion&&(
              <div style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1.1rem',marginBottom:'1rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.65rem',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:10,height:2,background:NAVY,display:'inline-block',borderRadius:1}}></span>Add your answer · 50–150 words
                </div>
                <textarea value={answerBody} onChange={e=>setAnswerBody(e.target.value)} placeholder="Be specific — what was the signal, how did you spot it, what did you do? Real experience only." style={{width:'100%',minHeight:90,background:'#F8FAFC',border:`1px solid ${BORDER}`,borderRadius:6,padding:'.75rem .9rem',color:TEXT,fontSize:13,fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.6,marginBottom:'.6rem'}}/>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontFamily:'monospace',fontSize:10,color:wc<50||wc>150?'#DC2626':TEXT_FAINT}}>{wc} / 150 words {wc<50&&wc>0?'(min 50)':''}{wc>150?'(max 150)':''}</span>
                  <button onClick={handleAnswer} disabled={posting} style={{background:NAVY,border:'none',color:'#fff',fontFamily:'monospace',fontSize:10,letterSpacing:'.08em',padding:'8px 18px',borderRadius:6,cursor:'pointer',opacity:posting?.7:1}}>
                    {posting?'Posting...':'Post Answer →'}
                  </button>
                </div>
              </div>
            )}

            {/* ANSWERS */}
            {answers.length>0&&(
              <>
                <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:'.65rem',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:10,height:2,background:NAVY,display:'inline-block',borderRadius:1}}></span>
                  {answers.length} answers — Playbook Picks marked by Yuvaraj
                </div>
                {answers.map(answer=>(
                  <div key={answer.id} style={{background:'#fff',border:`1px solid ${BORDER}`,borderRadius:10,padding:'1rem',marginBottom:'.65rem',boxShadow:'0 1px 3px rgba(22,59,109,0.06)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'.65rem',marginBottom:'.65rem'}}>
                      <div style={{width:34,height:34,borderRadius:'50%',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:10,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {answer.author_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontFamily:'serif',fontSize:13,fontWeight:500,color:TEXT}}>{answer.author_name}</span>
                          {answer.author_tier&&<span style={{fontFamily:'monospace',fontSize:8,color:NAVY,background:NAVY_LIGHT,padding:'1px 7px',borderRadius:20}}>{TIER_LABELS[answer.author_tier]}</span>}
                        </div>
                        <div style={{fontFamily:'monospace',fontSize:9,color:TEXT_FAINT,letterSpacing:'.04em'}}>{answer.author_role}</div>
                      </div>
                    </div>
                    <div style={{fontSize:13.5,color:TEXT_MID,lineHeight:1.8,fontWeight:300}}>{answer.body}</div>
                    <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginTop:'.65rem',paddingTop:'.65rem',borderTop:`1px solid ${BORDER}`}}>
                      <button onClick={()=>handleSave(answer.id)} style={{fontFamily:'monospace',fontSize:9,color:saved.has(answer.id)?NAVY:TEXT_FAINT,padding:'4px 10px',border:`1px solid ${saved.has(answer.id)?NAVY:BORDER}`,borderRadius:20,cursor:'pointer',background:saved.has(answer.id)?NAVY_LIGHT:'none'}}>
                        ◈ {saved.has(answer.id)?'Saved to Playbook':'Save to Playbook'}
                      </button>
                      {answer.save_count>0&&<span style={{fontFamily:'monospace',fontSize:8,color:GREEN,background:GREEN_BG,borderRadius:20,padding:'2px 8px',border:`1px solid ${GREEN_BORDER}`,marginLeft:'auto'}}>✓ Playbook Pick</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div style={{maxWidth:780,margin:'2rem auto 1rem',padding:'1rem',borderTop:`1px solid ${BORDER}`,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}><strong style={{color:NAVY}}>Project Perfect Community</strong> · For manufacturing ops leaders who are done managing projects on hope.</span>
        <span style={{fontFamily:'monospace',fontSize:10,color:TEXT_FAINT}}>projectperfect.in/community</span>
      </div>

      {toast&&<div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',background:NAVY,color:'#fff',fontFamily:'monospace',fontSize:11,padding:'.65rem 1.25rem',borderRadius:6,zIndex:999,boxShadow:'0 4px 16px rgba(22,59,109,0.3)'}}>{toast}</div>}
    </div>
  )
}