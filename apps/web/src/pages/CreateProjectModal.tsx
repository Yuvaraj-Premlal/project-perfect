import { useState } from 'react'
import { createProject } from '../api/projects'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (projectId: string) => void
}

export default function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm] = useState({
    project_name:      '',
    project_code:      '',
    customer_name:     '',
    customer_ref:      '',
    start_date:        new Date().toISOString().split('T')[0],
    planned_end_date:  '',
    launch_date_target:'',
    risk_tier:         'high',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const project = await createProject(form)
      qc.invalidateQueries({ queryKey: ['projects'] })
      onCreated(project.project_id)
      onClose()
      setForm({
        project_name:'', project_code:'', customer_name:'', customer_ref:'',
        start_date: new Date().toISOString().split('T')[0],
        planned_end_date:'', launch_date_target:'', risk_tier:'high',
      })
    } catch (err: any) {
      const detail = err?.response?.data?.details
      if (detail) setError(detail.map((d: any) => d.message).join(' · '))
      else setError(err?.response?.data?.error || 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-header">
          <div className="modal-title">New Project</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Section: Identity */}
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Project Identity</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                <label className="form-label">Project name *</label>
                <input className="form-input" value={form.project_name} onChange={e=>set('project_name',e.target.value)} required placeholder="e.g. Fuel Manifold v3" />
              </div>
              <div className="form-group">
                <label className="form-label">Project code (Q number)</label>
                <input className="form-input" value={form.project_code} onChange={e=>set('project_code',e.target.value)} placeholder="e.g. Q-042" />
              </div>
              <div className="form-group">
                <label className="form-label">Customer name</label>
                <input className="form-input" value={form.customer_name} onChange={e=>set('customer_name',e.target.value)} placeholder="e.g. Cummins" />
              </div>
              <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                <label className="form-label">Customer reference / PO number</label>
                <input className="form-input" value={form.customer_ref} onChange={e=>set('customer_ref',e.target.value)} placeholder="e.g. PO-2026-4421" />
              </div>
            </div>

            <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />

            {/* Section: Dates */}
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Timeline</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Start date *</label>
                <input className="form-input" type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Planned end date *</label>
                <input className="form-input" type="date" value={form.planned_end_date} onChange={e=>set('planned_end_date',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Launch date target</label>
                <input className="form-input" type="date" value={form.launch_date_target} onChange={e=>set('launch_date_target',e.target.value)} />
              </div>
            </div>

            <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />

            {/* Section: Risk */}
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Risk Environment</div>

            <div className="form-group">
              <label className="form-label">Risk tier *</label>
              <select className="form-input" value={form.risk_tier} onChange={e=>set('risk_tier',e.target.value)}>
                <option value="high">High — R&D / New design (EN=10)</option>
                <option value="moderate">Moderate — Proven new (EN=5)</option>
                <option value="low">Low — Proven old / Repeat (EN=2)</option>
              </select>
            </div>

            <div style={{ background:'var(--blue5)', border:'1px solid var(--blue4)', borderRadius:8, padding:'10px 12px', fontSize:11, color:'var(--text2)', lineHeight:1.6 }}>
              <strong style={{ color:'var(--navy)' }}>EN value</strong> is automatically assigned from risk tier and used in the PR calculation. It is never shown to users — only used internally by the PPM engine.
            </div>

            {error && (
              <div style={{ background:'var(--red-bg)', border:'1px solid #EAADA8', borderRadius:8, padding:'10px 12px', fontSize:12, color:'var(--red)' }}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="tb-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tb-btn primary" disabled={saving}>
              {saving ? 'Creating project...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
