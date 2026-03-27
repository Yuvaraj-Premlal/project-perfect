import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCCRs, createCCR } from '../api/projects'

const REASON_OPTIONS = [
  { value: 'customer_request',   label: 'Customer Request' },
  { value: 'scope_change',       label: 'Scope Change' },
  { value: 'regulatory',         label: 'Regulatory' },
  { value: 'force_majeure',      label: 'Force Majeure' },
  { value: 'other',              label: 'Other' },
]

const REQUESTED_BY_OPTIONS = [
  { value: 'customer',            label: 'Customer' },
  { value: 'internal_leadership', label: 'Internal Leadership' },
  { value: 'regulatory',          label: 'Regulatory' },
  { value: 'other',               label: 'Other' },
]

const AVAIL_OPTIONS = [
  { value: 'yes',     label: 'Yes — all data ready' },
  { value: 'partial', label: 'Partial — some gaps' },
  { value: 'no',      label: 'No — data not ready' },
]

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function CCRModal({ project, phases, onClose, onSaved }: {
  project: any
  phases: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    reason_category: 'customer_request',
    description: '',
    change_requested_by: 'customer',
    evidence_reference: '',
  })
  const [phaseEdits, setPhaseEdits] = useState<Record<string, any>>(
    Object.fromEntries(phases.map(p => [p.phase_id, {
      start_date: p.start_date || '',
      target_date: p.target_date || '',
      data_availability: p.data_availability || 'yes',
      marked_for_delete: false,
    }]))
  )
  const [newPhases, setNewPhases] = useState<any[]>([])

  function setF(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function setPhaseEdit(phaseId: string, field: string, value: any) {
    setPhaseEdits(prev => ({ ...prev, [phaseId]: { ...prev[phaseId], [field]: value } }))
  }

  function addNewPhase() {
    setNewPhases(prev => [...prev, { phase_name: '', start_date: '', target_date: '', data_availability: 'yes' }])
  }

  function updateNewPhase(idx: number, field: string, value: string) {
    setNewPhases(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function removeNewPhase(idx: number) {
    setNewPhases(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.description.trim().length < 50) {
      setError('Description must be at least 50 characters.')
      return
    }
    if (!form.evidence_reference.trim()) {
      setError('Evidence reference is required.')
      return
    }
    const phase_changes = phases
      .filter(p => {
        const edit = phaseEdits[p.phase_id]
        if (!edit || edit.marked_for_delete) return false
        return (
          (edit.start_date && edit.start_date !== (p.start_date || '')) ||
          (edit.target_date && edit.target_date !== (p.target_date || '')) ||
          (edit.data_availability !== p.data_availability)
        )
      })
      .map(p => {
        const edit = phaseEdits[p.phase_id]
        return {
          phase_id: p.phase_id,
          start_date: edit.start_date !== (p.start_date || '') ? edit.start_date : null,
          target_date: edit.target_date !== (p.target_date || '') ? edit.target_date : null,
          data_availability: edit.data_availability !== p.data_availability ? edit.data_availability : null,
        }
      })
    const phases_to_delete = phases.filter(p => phaseEdits[p.phase_id]?.marked_for_delete).map(p => p.phase_id)
    const phases_to_add = newPhases.filter(p => p.phase_name && p.start_date && p.target_date)
    if (phase_changes.length === 0 && phases_to_delete.length === 0 && phases_to_add.length === 0) {
      setError('No changes detected. Please modify at least one phase.')
      return
    }
    setSaving(true)
    try {
      await createCCR(project.project_id, { ...form, phase_changes, phases_to_delete, phases_to_add })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to submit CCR.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Raise Charter Change Request</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Changes will be applied immediately and recorded permanently</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
            {error && <div className="alert-banner red">⚠ {error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Reason category *</label>
                <select className="form-input" value={form.reason_category} onChange={e => setF('reason_category', e.target.value)}>
                  {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Change requested by *</label>
                <select className="form-input" value={form.change_requested_by} onChange={e => setF('change_requested_by', e.target.value)}>
                  {REQUESTED_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">
                Description * <span style={{ color: 'var(--text4)', fontWeight: 400 }}>(min 50 chars — {form.description.length} typed)</span>
              </label>
              <textarea className="form-input" rows={3} value={form.description}
                onChange={e => setF('description', e.target.value)}
                placeholder="Describe the reason for this change request in detail..." />
            </div>
            <div className="form-group">
              <label className="form-label">
                Evidence reference * <span style={{ color: 'var(--text4)', fontWeight: 400 }}>(email ref, change order, document link)</span>
              </label>
              <input className="form-input" value={form.evidence_reference}
                onChange={e => setF('evidence_reference', e.target.value)}
                placeholder="e.g. Email from John Smith dated 26-Mar-2026, CO-1234" />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Modify existing phases</div>
              {phases.map(p => {
                const edit = phaseEdits[p.phase_id]
                const isDeleted = edit?.marked_for_delete
                return (
                  <div key={p.phase_id} style={{
                    border: `1px solid ${isDeleted ? 'var(--red)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '12px 14px', marginBottom: 10,
                    background: isDeleted ? 'var(--red-bg)' : 'var(--bg)',
                    opacity: isDeleted ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isDeleted ? 0 : 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDeleted ? 'var(--red)' : 'var(--text)' }}>
                        {p.phase_name}
                        {isDeleted && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400 }}>— marked for deletion</span>}
                      </div>
                      <button type="button"
                        onClick={() => setPhaseEdit(p.phase_id, 'marked_for_delete', !isDeleted)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)',
                          background: isDeleted ? 'var(--white)' : 'var(--red-bg)',
                          color: isDeleted ? 'var(--text2)' : 'var(--red)', cursor: 'pointer' }}>
                        {isDeleted ? '↩ Restore' : '🗑 Delete phase'}
                      </button>
                    </div>
                    {!isDeleted && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Start date</label>
                          <input className="form-input" type="date" value={edit?.start_date || ''}
                            onChange={e => setPhaseEdit(p.phase_id, 'start_date', e.target.value)} />
                          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>Current: {fmt(p.start_date)}</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">End date</label>
                          <input className="form-input" type="date" value={edit?.target_date || ''}
                            onChange={e => setPhaseEdit(p.phase_id, 'target_date', e.target.value)} />
                          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>Current: {fmt(p.target_date)}</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Data availability</label>
                          <select className="form-input" value={edit?.data_availability || p.data_availability}
                            onChange={e => setPhaseEdit(p.phase_id, 'data_availability', e.target.value)}>
                            {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Add new phases</div>
              {newPhases.map((p, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10, background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>New Phase {idx + 1}</div>
                    <button type="button" onClick={() => removeNewPhase(idx)}
                      style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Phase name *</label>
                      <input className="form-input" value={p.phase_name}
                        onChange={e => updateNewPhase(idx, 'phase_name', e.target.value)} placeholder="e.g. PPAP" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Start date *</label>
                      <input className="form-input" type="date" value={p.start_date}
                        onChange={e => updateNewPhase(idx, 'start_date', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End date *</label>
                      <input className="form-input" type="date" value={p.target_date}
                        onChange={e => updateNewPhase(idx, 'target_date', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Data availability</label>
                      <select className="form-input" value={p.data_availability}
                        onChange={e => updateNewPhase(idx, 'data_availability', e.target.value)}>
                        {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="tb-btn" onClick={addNewPhase}>
                + Add phase
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="tb-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="tb-btn primary" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit CCR & apply changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CCRHistoryRow({ ccr }: { ccr: any }) {
  const [expanded, setExpanded] = useState(false)
  const before = ccr.changes_snapshot?.before?.phases || []
  const after = ccr.changes_snapshot?.after?.phases || []
  const summary = ccr.changes_snapshot?.summary || {}

  const reasonLabel: Record<string, string> = {
    customer_request: 'Customer Request',
    scope_change: 'Scope Change',
    regulatory: 'Regulatory',
    force_majeure: 'Force Majeure',
    other: 'Other',
  }

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={() => setExpanded(e => !e)}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
          style={{ flexShrink: 0, color: 'var(--text3)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{ccr.ccr_number}</span>
            <span className="tag blue">{reasonLabel[ccr.reason_category] || ccr.reason_category}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            {fmt(ccr.raised_at?.split('T')[0])} · Raised by {ccr.raised_by_name}
            {summary.phases_modified > 0 && ` · ${summary.phases_modified} phase(s) modified`}
            {summary.phases_added > 0 && ` · ${summary.phases_added} phase(s) added`}
            {summary.phases_deleted > 0 && ` · ${summary.phases_deleted} phase(s) deleted`}
          </div>
        </div>
        <span className="status green">Applied</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{ccr.description}</div>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 6 }}>Evidence reference</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{ccr.evidence_reference}</div>
            </div>
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Phase changes</div>
            <table className="tbl" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Start date</th>
                  <th>End date</th>
                  <th>Data availability</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {after.map((ap: any) => {
                  const bp = before.find((b: any) => b.phase_id === ap.phase_id)
                  const isNew = !bp
                  const startChanged = bp && bp.start_date !== ap.start_date
                  const endChanged = bp && bp.target_date !== ap.target_date
                  const availChanged = bp && bp.data_availability !== ap.data_availability
                  if (!isNew && !startChanged && !endChanged && !availChanged) return null
                  return (
                    <tr key={ap.phase_id}>
                      <td style={{ fontWeight: 500 }}>
                        {ap.phase_name}
                        {isNew && <span className="tag blue" style={{ marginLeft: 6 }}>New</span>}
                      </td>
                      <td>
                        {startChanged
                          ? <><span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{fmt(bp.start_date)}</span>{' → '}<span style={{ color: 'var(--green)' }}>{fmt(ap.start_date)}</span></>
                          : fmt(ap.start_date)}
                      </td>
                      <td>
                        {endChanged
                          ? <><span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{fmt(bp.target_date)}</span>{' → '}<span style={{ color: 'var(--green)' }}>{fmt(ap.target_date)}</span></>
                          : fmt(ap.target_date)}
                      </td>
                      <td>
                        {availChanged
                          ? <><span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{bp.data_availability}</span>{' → '}<span style={{ color: 'var(--green)' }}>{ap.data_availability}</span></>
                          : ap.data_availability}
                      </td>
                      <td><span className={`tag ${isNew ? 'blue' : 'amber'}`}>{isNew ? 'Added' : 'Modified'}</span></td>
                    </tr>
                  )
                })}
                {before
                  .filter((bp: any) => !after.find((ap: any) => ap.phase_id === bp.phase_id))
                  .map((bp: any) => (
                    <tr key={bp.phase_id}>
                      <td style={{ fontWeight: 500, textDecoration: 'line-through', color: 'var(--text3)' }}>{bp.phase_name}</td>
                      <td style={{ color: 'var(--text3)' }}>{fmt(bp.start_date)}</td>
                      <td style={{ color: 'var(--text3)' }}>{fmt(bp.target_date)}</td>
                      <td style={{ color: 'var(--text3)' }}>{bp.data_availability}</td>
                      <td><span className="tag red">Deleted</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CharterTab({ project, phases }: { project: any, phases: any[] }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: ccrs = [], isLoading } = useQuery({
    queryKey: ['ccrs', project.project_id],
    queryFn: () => getCCRs(project.project_id),
  })

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['ccrs', project.project_id] })
    qc.invalidateQueries({ queryKey: ['project', project.project_id] })
    qc.invalidateQueries({ queryKey: ['tasks', project.project_id] })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div className="page-title">Charter Change Requests</div>
          <div className="page-sub">
            {(ccrs as any[]).length} change request{(ccrs as any[]).length !== 1 ? 's' : ''} recorded · All changes applied immediately
          </div>
        </div>
        <button className="tb-btn primary" onClick={() => setShowModal(true)}>+ Raise Change Request</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Current baseline phases</div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Start date</th>
              <th>End date</th>
              <th>Data availability</th>
            </tr>
          </thead>
          <tbody>
            {phases.map(p => (
              <tr key={p.phase_id}>
                <td style={{ fontWeight: 500 }}>{p.phase_name}</td>
                <td><span className="mono" style={{ fontSize: 11 }}>{fmt(p.start_date)}</span></td>
                <td><span className="mono" style={{ fontSize: 11 }}>{fmt(p.target_date)}</span></td>
                <td>
                  <span className={`tag ${p.data_availability === 'yes' ? 'green' : p.data_availability === 'partial' ? 'amber' : 'red'}`}>
                    {p.data_availability === 'yes' ? 'Available' : p.data_availability === 'partial' ? 'Partial' : 'Not available'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text4)' }}>Loading...</div>
      ) : (ccrs as any[]).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text4)', fontSize: 12 }}>
          No change requests yet. Click "Raise Change Request" to record a baseline change.
        </div>
      ) : (
        (ccrs as any[]).map((ccr: any) => <CCRHistoryRow key={ccr.ccr_id} ccr={ccr} />)
      )}

      {showModal && (
        <CCRModal
          project={project}
          phases={phases}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
