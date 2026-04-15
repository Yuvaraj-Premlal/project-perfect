import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getCurrentUser } from '../api/auth'

async function fetchTemplates() {
  const res = await api.get('/api/templates')
  return res.data
}

async function fetchTemplate(id: string) {
  const res = await api.get(`/api/templates/${id}`)
  return res.data
}

interface TemplateTask {
  task_name: string
  acceptance_criteria: string
  control_type: string
}

interface TemplatePhase {
  phase_name: string
  tasks: TemplateTask[]
}

const CONTROL_COLORS: Record<string, string> = {
  internal: 'var(--blue)',
  supplier: 'var(--amber)',
  sub_supplier: 'var(--red)',
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const user = getCurrentUser()
  const canManage = user?.role === 'portfolio_manager' || user?.role === 'super_user'

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates
  })

  const [showCreate, setShowCreate] = useState(false)
  const [viewId, setViewId]         = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await api.delete(`/api/templates/${id}`)
      qc.invalidateQueries({ queryKey: ['templates'] })
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) return <div style={{ textAlign:'center', padding:60, color:'var(--text4)' }}>Loading templates...</div>

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="page-title">Templates</div>
          <div className="page-sub">Reusable project structures — phases and tasks ready to use</div>
        </div>
        {canManage && (
          <button className="tb-btn primary" onClick={() => setShowCreate(true)}>+ New Template</button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:56 }}>
          <div style={{ fontSize:32, marginBottom:16, opacity:0.2 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--text)" strokeWidth="1.5"/>
              <line x1="3" y1="9" x2="21" y2="9" stroke="var(--text)" strokeWidth="1.5"/>
              <line x1="9" y1="9" x2="9" y2="21" stroke="var(--text)" strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>No templates yet</div>
          <div style={{ fontSize:13, color:'var(--text4)', marginBottom: canManage ? 24 : 0, maxWidth:360, margin:'0 auto 24px' }}>
            Templates let PMs start new projects with pre-defined phases and tasks — saving setup time and ensuring consistency.
          </div>
          {canManage && (
            <button className="tb-btn primary" onClick={() => setShowCreate(true)}>Create first template</button>
          )}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14 }}>
          {templates.map((t: any) => (
            <div key={t.template_id} className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, lineHeight:1.5 }}>{t.description}</div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:11, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text3)' }}>
                    {t.phase_count} phase{t.phase_count !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize:11, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text3)' }}>
                    {t.task_count} task{t.task_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <span style={{ fontSize:11, color:'var(--text4)' }}>by {t.created_by_name || 'Unknown'}</span>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="tb-btn" style={{ fontSize:12 }} onClick={() => setViewId(t.template_id)}>View</button>
                  {canManage && (
                    <button className="tb-btn" style={{ fontSize:12, color:'var(--red)' }}
                      disabled={deleting === t.template_id}
                      onClick={() => handleDelete(t.template_id, t.name)}>
                      {deleting === t.template_id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && canManage && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['templates'] }) }}
        />
      )}

      {viewId && (
        <ViewTemplateModal templateId={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  )
}

// ─── Create Template Modal ────────────────────────────────────────
function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [name, setName]        = useState('')
  const [description, setDesc] = useState('')
  const [phases, setPhases]    = useState<TemplatePhase[]>([{ phase_name: '', tasks: [] }])
  const [saving, setSaving]    = useState(false)
  const [error, setError]      = useState('')

  function addPhase() { setPhases([...phases, { phase_name: '', tasks: [] }]) }
  function removePhase(idx: number) { setPhases(phases.filter((_, i) => i !== idx)) }
  function updatePhase(idx: number, value: string) {
    setPhases(phases.map((p, i) => i === idx ? { ...p, phase_name: value } : p))
  }
  function addTask(pi: number) {
    setPhases(phases.map((p, i) => i === pi
      ? { ...p, tasks: [...p.tasks, { task_name: '', acceptance_criteria: '', control_type: 'internal' }] }
      : p))
  }
  function removeTask(pi: number, ti: number) {
    setPhases(phases.map((p, i) => i === pi
      ? { ...p, tasks: p.tasks.filter((_, j) => j !== ti) }
      : p))
  }
  function updateTask(pi: number, ti: number, field: string, value: string) {
    setPhases(phases.map((p, i) => i === pi
      ? { ...p, tasks: p.tasks.map((t, j) => j === ti ? { ...t, [field]: value } : t) }
      : p))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Template name is required'); return }
    if (phases.every(p => !p.phase_name.trim())) { setError('At least one phase name is required'); return }
    setSaving(true); setError('')
    try {
      await api.post('/api/templates', { name, description, phases })
      onCreated()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save template')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth:700, width:'95vw', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ flexShrink:0 }}>
          <div className="modal-title">New Template</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

          {/* Name and description */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Template name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. New Product Introduction" autoFocus />
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Description</label>
              <input className="form-input" value={description} onChange={e => setDesc(e.target.value)}
                placeholder="When to use this template" />
            </div>
          </div>

          {/* Phases */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>
              Phases & Tasks
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {phases.map((phase, pi) => (
                <div key={pi} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                  {/* Phase header */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg)' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text4)', minWidth:52 }}>Phase {pi + 1}</span>
                    <input className="form-input" value={phase.phase_name}
                      onChange={e => updatePhase(pi, e.target.value)}
                      placeholder="Phase name" style={{ flex:1, fontSize:13 }} />
                    {phases.length > 1 && (
                      <button onClick={() => removePhase(pi)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text4)', fontSize:18, lineHeight:1, flexShrink:0 }}>×</button>
                    )}
                  </div>

                  {/* Tasks */}
                  {phase.tasks.length > 0 && (
                    <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                      {phase.tasks.map((task, ti) => (
                        <div key={ti} style={{ display:'grid', gridTemplateColumns:'1fr 140px 1fr 28px', gap:8, alignItems:'start' }}>
                          <input className="form-input" value={task.task_name}
                            onChange={e => updateTask(pi, ti, 'task_name', e.target.value)}
                            placeholder="Task name" style={{ fontSize:12 }} />
                          <select className="form-input" value={task.control_type}
                            onChange={e => updateTask(pi, ti, 'control_type', e.target.value)}
                            style={{ fontSize:12 }}>
                            <option value="internal">Internal</option>
                            <option value="supplier">Supplier</option>
                            <option value="sub_supplier">Sub-supplier</option>
                          </select>
                          <input className="form-input" value={task.acceptance_criteria}
                            onChange={e => updateTask(pi, ti, 'acceptance_criteria', e.target.value)}
                            placeholder="Acceptance criteria" style={{ fontSize:12 }} />
                          <button onClick={() => removeTask(pi, ti)}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text4)', fontSize:18, lineHeight:1, paddingTop:6 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add task */}
                  <div style={{ padding:'8px 14px', borderTop: phase.tasks.length > 0 ? '1px solid var(--border)' : 'none' }}>
                    <button className="tb-btn" style={{ fontSize:11 }} onClick={() => addTask(pi)}>+ Add task</button>
                  </div>
                </div>
              ))}
            </div>

            <button className="tb-btn" style={{ fontSize:12, marginTop:10 }} onClick={addPhase}>+ Add phase</button>
          </div>

          {error && (
            <div style={{ color:'var(--red)', fontSize:12, background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink:0, display:'flex', justifyContent:'flex-end', gap:10, padding:'14px 24px', borderTop:'1px solid var(--border)', background:'var(--bg)' }}>
          <button className="tb-btn" onClick={onClose}>Cancel</button>
          <button className="tb-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── View Template Modal ──────────────────────────────────────────
function ViewTemplateModal({ templateId, onClose }: { templateId: string, onClose: () => void }) {
  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => fetchTemplate(templateId)
  })

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth:600, width:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header" style={{ flexShrink:0 }}>
          <div className="modal-title">{isLoading ? 'Loading...' : template?.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:10 }}>
          {isLoading ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--text4)' }}>Loading...</div>
          ) : (
            <>
              {template?.description && (
                <div style={{ fontSize:13, color:'var(--text3)', marginBottom:6, lineHeight:1.6 }}>{template.description}</div>
              )}
              {template?.phases?.map((phase: any, pi: number) => (
                <div key={phase.phase_id} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ background:'var(--bg)', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{pi + 1}. {phase.phase_name}</span>
                    <span style={{ fontSize:11, color:'var(--text4)' }}>{phase.tasks?.length || 0} task{phase.tasks?.length !== 1 ? 's' : ''}</span>
                  </div>
                  {phase.tasks?.length > 0 && phase.tasks.map((task: any, _ti: number) => (
                    <div key={task.task_id} style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:12, alignItems:'flex-start' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:'var(--text)', marginBottom:3 }}>{task.task_name}</div>
                        {task.acceptance_criteria && (
                          <div style={{ fontSize:11, color:'var(--text4)', lineHeight:1.5 }}>{task.acceptance_criteria}</div>
                        )}
                      </div>
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:'var(--bg)', border:'1px solid var(--border)', color: CONTROL_COLORS[task.control_type] || 'var(--text3)', flexShrink:0, textTransform:'capitalize' }}>
                        {task.control_type?.replace('_', '-')}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
