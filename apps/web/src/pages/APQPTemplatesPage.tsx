import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getCurrentUser } from '../api/auth'

async function fetchTemplates() {
  const res = await api.get('/api/apqp/templates')
  return res.data
}

async function fetchTemplate(id: string) {
  const res = await api.get(`/api/apqp/templates/${id}`)
  return res.data
}

interface APQPElement {
  element_name: string
  planned_days: number
}

export default function APQPTemplatesPage() {
  const qc = useQueryClient()
  const user = getCurrentUser()
  const canManage = user?.role === 'portfolio_manager' || user?.role === 'super_user'
  const { data: templates = [], isLoading } = useQuery({ queryKey: ['apqp-templates'], queryFn: fetchTemplates })
  const [showCreate, setShowCreate] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete APQP template "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await api.delete(`/api/apqp/templates/${id}`)
      qc.invalidateQueries({ queryKey: ['apqp-templates'] })
    } finally { setDeleting(null) }
  }

  if (isLoading) return <div style={{ padding:48, textAlign:'center', color:'var(--text4)' }}>Loading...</div>

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="page-title">APQP Templates</div>
          <div className="page-sub">Define reusable APQP element sets for your projects</div>
        </div>
        {canManage && (
          <button className="tb-btn primary" onClick={() => setShowCreate(true)}>+ New Template</button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:56 }}>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>No APQP templates yet</div>
          <div style={{ fontSize:13, color:'var(--text4)', marginBottom: canManage ? 24 : 0 }}>
            Create a template with APQP elements and planned durations. PMs can select it when creating a project.
          </div>
          {canManage && <button className="tb-btn primary" onClick={() => setShowCreate(true)}>Create first template</button>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px,1fr))', gap:14 }}>
          {templates.map((t: any) => (
            <div key={t.template_id} className="card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{t.name}</div>
                {t.description && <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8, lineHeight:1.5 }}>{t.description}</div>}
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:11, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', color:'var(--text3)' }}>
                    {t.element_count} element{t.element_count !== 1 ? 's' : ''}
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
        <CreateAPQPTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['apqp-templates'] }) }}
        />
      )}
      {viewId && <ViewAPQPTemplateModal templateId={viewId} onClose={() => setViewId(null)} />}
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────
function CreateAPQPTemplateModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [elements, setElements]   = useState<APQPElement[]>([{ element_name: '', planned_days: 10 }])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  function addElement() { setElements([...elements, { element_name: '', planned_days: 10 }]) }
  function removeElement(i: number) { setElements(elements.filter((_, idx) => idx !== i)) }
  function updateElement(i: number, field: string, value: any) {
    setElements(elements.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Template name is required'); return }
    if (elements.every(e => !e.element_name.trim())) { setError('At least one element is required'); return }
    setSaving(true); setError('')
    try {
      await api.post('/api/apqp/templates', { name, description, elements })
      onCreated()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth:640, width:'95vw', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header" style={{ flexShrink:0 }}>
          <div className="modal-title">New APQP Template</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Template name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard APQP" autoFocus />
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Description</label>
              <input className="form-input" value={description} onChange={e => setDesc(e.target.value)} placeholder="When to use this template" />
            </div>
          </div>

          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
              APQP Elements
            </div>
            <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 32px', gap:0, background:'var(--bg2)', padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Element Name</div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Days</div>
                <div />
              </div>
              {elements.map((el, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 100px 32px', gap:8, padding:'8px 12px', borderBottom: i < elements.length - 1 ? '1px solid var(--border)' : 'none', alignItems:'center' }}>
                  <input className="form-input" value={el.element_name}
                    onChange={e => updateElement(i, 'element_name', e.target.value)}
                    placeholder={`Element ${i + 1}`} style={{ fontSize:13 }} />
                  <input className="form-input" type="number" min={1} max={365}
                    value={el.planned_days}
                    onChange={e => updateElement(i, 'planned_days', parseInt(e.target.value) || 1)}
                    style={{ fontSize:13 }} />
                  {elements.length > 1 && (
                    <button onClick={() => removeElement(i)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text4)', fontSize:18, lineHeight:1 }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <button className="tb-btn" style={{ fontSize:12, marginTop:10 }} onClick={addElement}>+ Add element</button>
          </div>

          {error && <div style={{ color:'var(--red)', fontSize:12, background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>}
        </div>
        <div style={{ flexShrink:0, display:'flex', justifyContent:'flex-end', gap:10, padding:'14px 24px', borderTop:'1px solid var(--border)', background:'var(--bg2)' }}>
          <button className="tb-btn" onClick={onClose}>Cancel</button>
          <button className="tb-btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Template'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── View Modal ───────────────────────────────────────────────────
function ViewAPQPTemplateModal({ templateId, onClose }: { templateId: string, onClose: () => void }) {
  const { data: template, isLoading } = useQuery({
    queryKey: ['apqp-template', templateId],
    queryFn: () => fetchTemplate(templateId)
  })

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth:520, width:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header" style={{ flexShrink:0 }}>
          <div className="modal-title">{isLoading ? 'Loading...' : template?.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {isLoading ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--text4)' }}>Loading...</div>
          ) : (
            <>
              {template?.description && <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16, lineHeight:1.6 }}>{template.description}</div>}
              <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px', background:'var(--bg2)', padding:'8px 14px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>#</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Element</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Days</div>
                </div>
                {template?.elements?.map((el: any, i: number) => (
                  <div key={el.element_id} style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px', padding:'10px 14px', borderBottom: i < template.elements.length - 1 ? '1px solid var(--border)' : 'none', alignItems:'center' }}>
                    <div style={{ fontSize:12, color:'var(--text4)' }}>{el.sequence_order}</div>
                    <div style={{ fontSize:13, color:'var(--text)' }}>{el.element_name}</div>
                    <div style={{ fontSize:12, color:'var(--text2)' }}>{el.planned_days}d</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
