import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createProject } from '../api/projects'

interface Phase {
  phase_name: string
  start_date: string
  target_date: string
  data_availability: 'yes' | 'no' | 'partial'
  phase_order: number
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (projectId: string) => void
}

const RISK_OPTIONS = [
  {
    value: 'high',
    label: 'High',
    desc: 'New design in the market, new to the organisation',
    color: 'var(--red)',
    bg: 'var(--red-bg)',
    border: '#EAADA8'
  },
  {
    value: 'moderate',
    label: 'Medium',
    desc: 'Proven design in the market, new to the organisation',
    color: 'var(--amber)',
    bg: 'var(--amber-bg)',
    border: '#F0C87A'
  },
  {
    value: 'low',
    label: 'Low',
    desc: 'Proven design in the market, similar project done in the organisation',
    color: 'var(--green)',
    bg: 'var(--green-bg)',
    border: '#B3D9C7'
  },
]

const AVAIL_OPTIONS = [
  { value: 'yes',     label: 'Yes — all data ready' },
  { value: 'partial', label: 'Partial — some gaps' },
  { value: 'no',      label: 'No — data not ready' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

export default function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const [step, setStep]           = useState(1)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // Step 1 — Identity
  const [projectName, setProjectName]       = useState('')
  const [launchDate, setLaunchDate]         = useState('')
  const [projectCode, setProjectCode]       = useState('')
  const [customerName, setCustomerName]     = useState('')
  const [productName, setProductName]       = useState('')

  // Step 2 — Phases
  const [phases, setPhases] = useState<Phase[]>([])

  // Step 3 — Risk
  const [riskTier, setRiskTier] = useState<'high' | 'moderate' | 'low'>('high')

  function addPhase() {
    setPhases(prev => [...prev, {
      phase_name: '',
      start_date: '',
      target_date: '',
      data_availability: 'yes',
      phase_order: prev.length + 1
    }])
  }

  function removePhase(idx: number) {
    setPhases(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, phase_order: i + 1 })))
  }

  function updatePhase(idx: number, field: keyof Phase, value: string) {
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  // Derived project timeline from phases
  const totalStart = phases.length > 0 ? phases[0].start_date : null
  const totalEnd   = phases.length > 0 ? phases[phases.length - 1].target_date : null

  async function loadTemplates() {
    setLoadingTmpl(true)
    try {
      const res = await api.get('/api/templates')
      setTemplates(res.data)
    } finally {
      setLoadingTmpl(false)
    }
  }

  async function applyTemplate(tmpl: any) {
    const res = await api.get(`/api/templates/${tmpl.template_id}`)
    const full = res.data
    setSelectedTemplate(full)
    // Pre-populate phases from template (no dates yet)
    setPhases(full.phases.map((p: any, i: number) => ({
      phase_name: p.phase_name,
      start_date: '',
      target_date: '',
      data_availability: 'yes',
      phase_order: i + 1
    })))
    setStep(1)
  }

  function canProceedStep1() {
    return projectName.trim() !== '' && launchDate !== ''
  }

  function canProceedStep2() {
    if (phases.length === 0) return false
    return phases.every(p => p.phase_name.trim() !== '' && p.start_date !== '' && p.target_date !== '' && p.target_date > p.start_date)
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const project = await createProject({
        project_name:       projectName,
        project_code:       projectCode || undefined,
        product_name:       productName || undefined,
        customer_name:      customerName || undefined,
        launch_date_target: launchDate,
        risk_tier:          riskTier,
        phases:             phases.map((p, i) => ({ ...p, phase_order: i + 1 })),
      })
      qc.invalidateQueries({ queryKey: ['projects'] })
      // If template was selected, create tasks from template
      if (selectedTemplate) {
        const projectPhases = project.phases || []
        console.log('Template phases:', selectedTemplate.phases)
        console.log('Project phases:', projectPhases)
        for (let pi = 0; pi < selectedTemplate.phases.length; pi++) {
          const tmplPhase = selectedTemplate.phases[pi]
          const projectPhase = projectPhases[pi]
          if (!projectPhase) continue
          for (const tmplTask of tmplPhase.tasks) {
            try {
              await api.post(`/api/projects/${project.project_id}/tasks`, {
                task_name:           tmplTask.task_name,
                acceptance_criteria: tmplTask.acceptance_criteria || '',
                control_type:        tmplTask.control_type || 'internal',
                phase_id:            projectPhase.phase_id,
                planned_start_date:  null,
                planned_end_date:    projectPhase.target_date,
              })
            } catch (e) {
              console.warn('Failed to create task from template:', tmplTask.task_name)
            }
          }
        }
      }
      onCreated(project.project_id)
      handleClose()
    } catch (err: any) {
      const detail = err?.response?.data?.details
      if (detail) setError(detail.map((d: any) => d.message).join(' · '))
      else setError(err?.response?.data?.error || 'Failed to create project')
      setStep(1)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setStep(0)
    setProjectName(''); setLaunchDate(''); setProjectCode(''); setCustomerName(''); setProductName('')
    setPhases([]); setRiskTier('high'); setError('')
    onClose()
  }
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    if (open) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])


  if (!open) return null

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ width: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">New Project</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{
                  height: 3, width: 48, borderRadius: 99,
                  background: s <= step ? 'var(--blue)' : 'var(--border)'
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
              {step === 0 ? 'New Project' : `Step ${step} of 3 — ${step === 1 ? 'Project Identity' : step === 2 ? 'Phases & Timeline' : 'Risk Environment'}`}
            </div>
          </div>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── STEP 1 — Identity ── */}
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:4 }}>How would you like to start?</div>
              {/* Start from scratch */}
              <div className="card" style={{ cursor:'pointer', border:'2px solid var(--border)', padding:20 }}
                onClick={() => setStep(1)}>
                <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                  <div style={{ width:40, height:40, background:'var(--bg)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:3 }}>Start from scratch</div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>Define your own phases and tasks</div>
                  </div>
                </div>
              </div>
              {/* Use a template */}
              <div className="card" style={{ cursor:'pointer', border:'2px solid var(--border)', padding:20 }}
                onClick={() => { loadTemplates(); setStep(-1) }}>
                <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                  <div style={{ width:40, height:40, background:'var(--bg)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--text2)" strokeWidth="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="var(--text2)" strokeWidth="1.5"/><line x1="9" y1="9" x2="9" y2="21" stroke="var(--text2)" strokeWidth="1.5"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:3 }}>Use a template</div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>Start with pre-defined phases and tasks</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === -1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:4 }}>Select a template</div>
              {loadingTmpl ? (
                <div style={{ textAlign:'center', padding:32, color:'var(--text4)' }}>Loading templates...</div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign:'center', padding:32, color:'var(--text4)' }}>No templates available. Ask your Portfolio Manager to create one.</div>
              ) : templates.map((t: any) => (
                <div key={t.template_id} className="card" style={{ cursor:'pointer', border:'1px solid var(--border)', padding:16 }}
                  onClick={() => applyTemplate(t)}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>{t.description}</div>}
                  <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--text4)' }}>
                    <span>{t.phase_count} phase{t.phase_count !== 1 ? 's' : ''}</span>
                    <span>{t.task_count} task{t.task_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel>Project Identity</SectionLabel>

              <div className="form-group">
                <label className="form-label">Project name *</label>
                <input className="form-input" value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. Mobile App Redesign" autoFocus />
              </div>

              <div className="form-group">
                <label className="form-label">Project launch date *</label>
                <input className="form-input" type="date" value={launchDate}
                  onChange={e => setLaunchDate(e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 3 }}>Target go-live or delivery date</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Project code</label>
                  <input className="form-input" value={projectCode}
                    onChange={e => setProjectCode(e.target.value)}
                    placeholder="e.g. PRJ-042" />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer name</label>
                  <input className="form-input" value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. Acme Corp" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Product name</label>
                <input className="form-input" value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Product name or number" />
              </div>
            </div>
          )}

          {/* ── STEP 2 — Phases ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel>Phases & Timeline</SectionLabel>

              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, background: 'var(--blue5)', border: '1px solid var(--blue4)', borderRadius: 8, padding: '10px 12px' }}>
                Define the phases of your project. <strong>Phase dates are locked once saved</strong> — you can add new phases later but cannot change existing ones.
              </div>

              {phases.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text4)', fontSize: 12 }}>
                  No phases yet. Click Add Phase to define your project timeline.
                </div>
              )}

              {phases.map((phase, idx) => (
                <div key={idx} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Phase {idx + 1}
                    </div>
                    <button onClick={() => removePhase(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Phase name *</label>
                      <input className="form-input" value={phase.phase_name}
                        onChange={e => updatePhase(idx, 'phase_name', e.target.value)}
                        placeholder="e.g. Design, Development, Testing..." />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="form-group">
                        <label className="form-label">Start date *</label>
                        <input className="form-input" type="date" value={phase.start_date}
                          onChange={e => updatePhase(idx, 'start_date', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Completion date *</label>
                        <input className="form-input" type="date" value={phase.target_date}
                          onChange={e => updatePhase(idx, 'target_date', e.target.value)}
                          min={phase.start_date || undefined} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Data availability at launch</label>
                      <select className="form-input" value={phase.data_availability}
                        onChange={e => updatePhase(idx, 'data_availability', e.target.value)}>
                        {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {phase.start_date && phase.target_date && phase.target_date > phase.start_date && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                      Duration: {Math.round((new Date(phase.target_date).getTime() - new Date(phase.start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                    </div>
                  )}
                  {phase.start_date && phase.target_date && phase.target_date <= phase.start_date && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)' }}>
                      ⚠ Completion date must be after start date
                    </div>
                  )}
                </div>
              ))}

              <button className="tb-btn" onClick={addPhase} style={{ width: 'fit-content' }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Add Phase
              </button>

              {totalStart && totalEnd && (
                <div style={{ background: 'var(--blue5)', border: '1px solid var(--blue4)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                  <span style={{ color: 'var(--text3)' }}>Total project timeline: </span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--navy)' }}>
                    {new Date(totalStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' → '}
                    {new Date(totalEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                    ({Math.round((new Date(totalEnd).getTime() - new Date(totalStart).getTime()) / (1000 * 60 * 60 * 24))} days)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3 — Risk ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel>Risk Environment</SectionLabel>

              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                Select the risk environment that best describes this project. This determines how the system weights risks and calculates project health metrics.
              </div>

              {RISK_OPTIONS.map(opt => (
                <div key={opt.value}
                  onClick={() => setRiskTier(opt.value as any)}
                  style={{
                    border: `2px solid ${riskTier === opt.value ? opt.color : 'var(--border)'}`,
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                    background: riskTier === opt.value ? opt.bg : 'var(--white)',
                    transition: 'all 0.13s'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${opt.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {riskTier === opt.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: opt.color }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Project Summary</div>
                {[
                  ['Project', projectName],
                  ['Launch date', launchDate ? new Date(launchDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                  ['Product', productName || '—'],
                  ['Customer', customerName || '—'],
                  ['Phases', `${phases.length} phase${phases.length !== 1 ? 's' : ''}`],
                  ['Timeline', totalStart && totalEnd ? `${new Date(totalStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → ${new Date(totalEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : '—'],
                  ['Risk', RISK_OPTIONS.find(r => r.value === riskTier)?.label || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)' }}>{label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid #EAADA8', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="tb-btn" onClick={handleClose}>Cancel</button>
          {step === -1 && (
            <button className="tb-btn" onClick={() => setStep(0)}>← Back</button>
          )}
          {step > 1 && (
            <button className="tb-btn" onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          {step < 3 && (
            <button className="tb-btn primary"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canProceedStep1() : !canProceedStep2()}
              style={{ display: step <= 0 ? 'none' : undefined }}>
              Next →
            </button>
          )}
          {step === 3 && (
            <button className="tb-btn primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
