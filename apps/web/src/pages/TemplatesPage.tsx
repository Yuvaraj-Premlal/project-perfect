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
      setDeleting(null) }
  }

  if (isLoading) return <div style={{ textAlign:'center', padding:60, color:'var(--text4)' }}>Loading templates...</div>

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div className="page-title">Project Templates</div>
          <div className="page-sub">Reusable project structures for your organisation</div>
        </div>
        {canManage && (
          <button className="tb-btn primary" onClick={() => setShowCreate(true)}>
            + New Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text2)', marginBottom:8 }}>No templates yet</div>
          <div style={{ fontSize:13, color:'var(--text4)', marginBottom:canManage ? 20 : 0 }}>
            Templates let PMs create projects with pre-defined phases and tasks.
          </div>
          {canManage && (
            <button className="tb-btn primary" onClick={() => setShowCreate(true)}>Create first template</button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {templates.map((t: any) => (
            <div key={t.template_id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{t.name}</div>
                {t.description && <div style={{ fontSize:12, color:'var(--text3)', marginBottom:6 }}>{t.description}</div>}
                <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text4)' }}>
                  <span>{t.phase_count} phase{t.phase_count !== 1 ? 's' : ''}</span>
                  <span>{t.task_count} task{t.task_count !== 1 ? 's' : ''}</span>
                  <span>Created by {t.created_by_name || 'Unknown'}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="tb-btn" style={{ fontSize:12 }} onClick={() => setViewId(t.template_id)}>
                  View
                </button>
                {canManage && (
                  <button className="tb-btn" style={{ fontSize:12, color:'var(--red)' }}
                    disabled={deleting === t.template_id}
                    onClick={() => handleDelete(t.template_id, t.name)}>
                    {deleting === t.template_id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && canManage && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['templates'] })
          }}
        />
      )}

      {viewId && (
        <ViewTemplateModal
          templateId={viewId}
          onClose={() => setViewId(null)}
        />
      )}
    </div>
  )
}

// ─── Create Template Modal ────────────────────────────────────────
function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [phases, setPhases]       = useState<TemplatePhase[]>([{ phase_name: '', tasks: [] }])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  function addPhase() {
    setPhases([...phases, { phase_name: '', tasks: [] }])
  }

  function removePhase(idx: number) {
    setPhases(phases.filter((_, i) => i !== idx))
  }

  function updatePhase(idx: number, value: string) {
    setPhases(phases.map((p, i) => i === idx ? { ...p, phase_name: value } : p))
  }

  function addTask(phaseIdx: number) {
    setPhases(phases.map((p, i) => i === phaseIdx
      ? { ...p, tasks: [...p.tasks, { task_name: '', acceptance_criteria: '', control_type: 'internal' }] }
      : p
    ))
  }

  function removeTask(phaseIdx: number, taskIdx: number) {
    setPhases(phases.map((p, i) => i === phaseIdx
      ? { ...p, tasks: p.tasks.filter((_, j) => j !== taskIdx) }
      : p
    ))
  }

  function updateTask(phaseIdx: number, taskIdx: number, field: string, value: string) {
    setPhases(phases.map((p, i) => i === phaseIdx
      ? { ...p, tasks: p.tasks.map((t, j) => j === taskIdx ? { ...t, [field]: value } : t) }
      : p
    ))
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth:680, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header">
          <div className="modal-title">New Template</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'4px 0' }}>
          <div className="form-group">
            <label className="form-label">Template name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Product Introduction" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={description} onChange={e => setDesc(e.target.value)} placeholder="Brief description of when to use this template" />
          </div>

          <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>Phases & Tasks</div>
            {phases.map((phase, pi) => (
              <div key={pi} style={{ border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:12 }}>
                <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text4)', minWidth:60 }}>Phase {pi + 1}</span>
                  <input className="form-input" value={phase.phase_name}
                    onChange={e => updatePhase(pi, e.target.value)}
                    placeholder="Phase name" style={{ flex:1 }} />
                  {phases.length > 1 && (
                    <button className="tb-btn" style={{ fontSize:11, color:'var(--red)', flexShrink:0 }}
                      onClick={() => removePhase(pi)}>Remove</button>
                  )}
                </div>

                {phase.tasks.map((task, ti) => (
                  <div key={ti} style={{ background:'var(--bg)', borderRadius:6, padding:10, marginBottom:8 }}>
                    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                      <input className="form-input" value={task.task_name}
                        onChange={e => updateTask(pi, ti, 'task_name', e.target.value)}
                        placeholder="Task name" style={{ flex:1, fontSize:12 }} />
                      <select className="form-input" value={task.control_type}
                        onChange={e => updateTask(pi, ti, 'control_type', e.target.value)}
                        style={{ width:130, fontSize:12 }}>
                        <option value="internal">Internal</option>
                        <option value="supplier">Supplier</option>
                        <option value="sub_supplier">Sub-supplier</option>
                      </select>
                      <button className="tb-btn" style={{ fontSize:11, color:'var(--red)', flexShrink:0 }}
                        onClick={() => removeTask(pi, ti)}>×</button>
                    </div>
                    <input className="form-input" value={task.acceptance_criteria}
                      onChange={e => updateTask(pi, ti, 'acceptance_criteria', e.target.value)}
                      placeholder="Acceptance criteria" style={{ fontSize:12 }} />
                  </div>
                ))}

                <button className="tb-btn" style={{ fontSize:11, marginTop:4 }} onClick={() => addTask(pi)}>
                  + Add task
                </button>
              </div>
            ))}

            <button className="tb-btn" style={{ fontSize:12 }} onClick={addPhase}>
              + Add phase
            </button>
          </div>

          {error && <div style={{ color:'var(--red)', fontSize:12, background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <button className="tb-btn" onClick={onClose}>Cancel</button>
            <button className="tb-btn primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
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
      <div className="modal" style={{ maxWidth:600, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header">
          <div className="modal-title">{isLoading ? 'Loading...' : template?.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {isLoading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--text4)' }}>Loading...</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {template?.description && (
              <div style={{ fontSize:13, color:'var(--text3)', marginBottom:4 }}>{template.description}</div>
            )}
            {template?.phases?.map((phase: any, pi: number) => (
              <div key={phase.phase_id} style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                <div style={{ background:'var(--bg)', padding:'10px 14px', fontSize:13, fontWeight:600, color:'var(--text)' }}>
                  {pi + 1}. {phase.phase_name}
                  <span style={{ fontSize:11, fontWeight:400, color:'var(--text4)', marginLeft:8 }}>
                    {phase.tasks?.length || 0} task{phase.tasks?.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {phase.tasks?.length > 0 && (
                  <div>
                    {phase.tasks.map((task: any, _ti: number) => (
                      <div key={task.task_id} style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:12, alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, color:'var(--text)', marginBottom:3 }}>{task.task_name}</div>
                          {task.acceptance_criteria && (
                            <div style={{ fontSize:11, color:'var(--text4)' }}>{task.acceptance_criteria}</div>
                          )}
                        </div>
                        <span className={`status ${task.control_type === 'internal' ? 'blue' : 'amber'}`} style={{ fontSize:10, flexShrink:0 }}>
                          {task.control_type?.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
