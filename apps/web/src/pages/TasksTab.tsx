import React, { useState } from 'react'
import { createTask, updateTask } from '../api/projects'

// ─── Types ────────────────────────────────────────────────────────
interface Phase {
  phase_id: string
  phase_name: string
  phase_order: number
  start_date: string
  target_date: string
  data_availability: 'yes' | 'no' | 'partial'
}

interface Task {
  task_id: string
  task_name: string
  acceptance_criteria: string
  control_type: 'internal' | 'supplier' | 'sub_supplier'
  owner_email: string | null
  owner_department: string | null
  phase_id: string | null
  phase_name: string | null
  planned_start_date: string | null
  planned_end_date: string
  current_ecd: string | null
  delay_days: number
  slippage_count: number
  risk_label: string
  risk_number: number
  completion_status: string
  comments: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────
function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function getRiskStyle(label: string): { cls: string; text: string } {
  const m: Record<string, { cls: string; text: string }> = {
    high_risk:  { cls: 'red',   text: 'High Risk' },
    moderate:   { cls: 'amber', text: 'Moderate' },
    monitoring: { cls: 'blue',  text: 'Monitoring' },
    on_track:   { cls: 'green', text: 'On Track' },
    complete:   { cls: 'navy',  text: 'Complete' },
  }
  return m[label] || m.on_track
}

function getStatusStyle(status: string): { cls: string; text: string } {
  const m: Record<string, { cls: string; text: string }> = {
    not_started: { cls: 'navy',  text: 'Not Started' },
    in_progress: { cls: 'blue',  text: 'In Progress' },
    complete:    { cls: 'green', text: 'Complete' },
    blocked:     { cls: 'red',   text: 'Blocked' },
  }
  return m[status] || { cls: 'navy', text: status }
}

// Phase-level risk: red > amber > blue > green > grey
function getPhaseRiskIndicator(tasks: Task[]): { color: string; title: string } {
  if (!tasks.length) return { color: 'var(--text4)', title: 'No tasks' }
  const allComplete = tasks.every(t => t.completion_status === 'complete')
  if (allComplete) return { color: 'var(--text4)', title: 'All complete' }
  if (tasks.some(t => t.risk_label === 'high_risk')) return { color: 'var(--red)', title: 'High risk task present' }
  if (tasks.some(t => t.risk_label === 'moderate'))  return { color: 'var(--amber)', title: 'Moderate risk task present' }
  if (tasks.some(t => t.risk_label === 'monitoring')) return { color: 'var(--blue2)', title: 'Monitoring task present' }
  return { color: 'var(--green)', title: 'All on track' }
}

function getAvailabilityStyle(val: string): { cls: string; text: string } {
  if (val === 'yes')     return { cls: 'green', text: 'Data Available' }
  if (val === 'partial') return { cls: 'amber', text: 'Partial Data' }
  return { cls: 'red', text: 'No Data' }
}

// ─── Add Task Modal ───────────────────────────────────────────────
function AddTaskModal({
  projectId,
  phase,
  phases,
  onClose,
  onSaved,
}: {
  projectId: string
  phase: Phase
  phases: Phase[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [form, setForm] = useState({
    task_name:           '',
    owner_email:         '',
    owner_department:    '',
    phase_id:            phase.phase_id,
    control_type:        'internal',
    planned_start_date:  '',
    planned_end_date:    '',
    acceptance_criteria: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.acceptance_criteria.trim() || form.acceptance_criteria.trim().length < 10) {
      setError('Acceptance criteria must be at least 10 characters.')
      return
    }
    setSaving(true); setError(null)
    try {
      await createTask(projectId, {
        ...form,
        current_ecd: form.planned_end_date, // starts equal to planned end
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Add Task</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Phase: {phase.phase_name}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert-banner red" style={{ marginBottom: 0 }}>
                ⚠ {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Task name *</label>
              <input
                className="form-input"
                value={form.task_name}
                onChange={e => set('task_name', e.target.value)}
                required
                placeholder="e.g. Raw Material Readiness"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Owner email</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.owner_email}
                  onChange={e => set('owner_email', e.target.value)}
                  placeholder="owner@company.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Owner department</label>
                <input
                  className="form-input"
                  value={form.owner_department}
                  onChange={e => set('owner_department', e.target.value)}
                  placeholder="e.g. Engineering"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Phase *</label>
                <select
                  className="form-input"
                  value={form.phase_id}
                  onChange={e => set('phase_id', e.target.value)}
                  required
                >
                  {phases.map(p => (
                    <option key={p.phase_id} value={p.phase_id}>{p.phase_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Control type *</label>
                <select
                  className="form-input"
                  value={form.control_type}
                  onChange={e => set('control_type', e.target.value)}
                  required
                >
                  <option value="internal">Internal (CN=1)</option>
                  <option value="supplier">Supplier (CN=10)</option>
                  <option value="sub_supplier">Sub-Supplier (CN=100)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Planned start date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.planned_start_date}
                  onChange={e => set('planned_start_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Planned end date *</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.planned_end_date}
                  onChange={e => set('planned_end_date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Acceptance criteria *</label>
              <textarea
                className="form-input"
                value={form.acceptance_criteria}
                onChange={e => set('acceptance_criteria', e.target.value)}
                required
                placeholder="What does successful completion look like? (min 10 chars)"
                rows={3}
              />
            </div>

            <div
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                background: 'var(--bg)',
                borderRadius: 6,
                padding: '8px 12px',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: 'var(--text2)' }}>Note:</strong> Planned dates are locked after
              creation. Current ECD starts equal to planned end date and can be updated later.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="tb-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="tb-btn primary" disabled={saving}>
              {saving ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Task Update Slide-Out Panel ──────────────────────────────────
function TaskPanel({
  task,
  projectId,
  onClose,
  onSaved,
}: {
  task: Task
  projectId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [confirmComplete, setConfirm] = useState(false)
  const [form, setForm] = useState({
    current_ecd:       task.current_ecd || task.planned_end_date,
    completion_status: task.completion_status,
    comments:          task.comments || '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    // Enforce acceptance criteria confirmation when completing
    if (form.completion_status === 'complete' && !confirmComplete) {
      setError('You must confirm acceptance criteria before marking complete.')
      return
    }
    setSaving(true); setError(null)
    try {
      await updateTask(projectId, task.task_id, form)
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update task.')
    } finally {
      setSaving(false)
    }
  }

  const { cls: riskCls, text: riskText } = getRiskStyle(task.risk_label)
  const isCompleting = form.completion_status === 'complete' && task.completion_status !== 'complete'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,30,46,0.3)',
          zIndex: 900,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 440,
          background: 'var(--white)',
          borderLeft: '1px solid var(--border)',
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                {task.task_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {task.phase_name || 'No phase'} ·{' '}
                <span style={{ textTransform: 'capitalize' }}>
                  {task.control_type.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <span className={`status ${riskCls}`}>{riskText}</span>
            <span className={`status ${getStatusStyle(task.completion_status).cls}`}>
              {getStatusStyle(task.completion_status).text}
            </span>
            {task.delay_days > 0 && (
              <span className="mono" style={{ color: 'var(--red)', fontWeight: 600, fontSize: 11, alignSelf: 'center' }}>
                +{task.delay_days}d delay
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {error && (
            <div className="alert-banner red" style={{ marginBottom: 14 }}>⚠ {error}</div>
          )}

          {/* Read-only info */}
          <div style={{ marginBottom: 18 }}>
            <div className="section-label">Task details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0', fontSize: 12 }}>
              {[
                ['Planned end', fmt(task.planned_end_date)],
                ['Slippages', task.slippage_count > 0 ? `${task.slippage_count}` : '—'],
                ['Owner email', task.owner_email || '—'],
                ['Department', task.owner_department || '—'],
                ['RN', task.risk_number > 0 ? String(task.risk_number) : '—'],
                ['CN', task.control_type === 'sub_supplier' ? '100' : task.control_type === 'supplier' ? '10' : '1'],
              ].map(([label, val]) => (
                <React.Fragment key={label}>
                  <span style={{ color: 'var(--text3)' }}>{label}</span>
                  <span
                    style={{
                      color: label === 'Slippages' && task.slippage_count > 0 ? 'var(--red)' : 'var(--text)',
                      fontWeight: 500,
                      fontFamily: ['Planned end','RN','CN','Slippages'].includes(label) ? 'var(--mono)' : 'inherit',
                    }}
                  >
                    {val}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Acceptance criteria (read-only) */}
          <div style={{ marginBottom: 18 }}>
            <div className="section-label">Acceptance criteria</div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '10px 12px',
                lineHeight: 1.6,
              }}
            >
              {task.acceptance_criteria}
            </div>
          </div>

          {/* Editable fields */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Current ECD</label>
            <input
              className="form-input"
              type="date"
              value={form.current_ecd}
              onChange={e => set('current_ecd', e.target.value)}
            />
            {form.current_ecd > task.planned_end_date && (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
                ⚠ ECD is past planned end date — this will record a slippage
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={form.completion_status}
              onChange={e => {
                set('completion_status', e.target.value)
                if (e.target.value !== 'complete') setConfirm(false)
              }}
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Comments</label>
            <textarea
              className="form-input"
              value={form.comments}
              onChange={e => set('comments', e.target.value)}
              placeholder="Latest update, blockers, or notes..."
              rows={3}
            />
          </div>

          {/* Acceptance confirmation — only shown when marking complete */}
          {isCompleting && (
            <div
              style={{
                background: 'var(--green-bg)',
                border: '1px solid #B3D9C7',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>
                ✓ Confirm acceptance criteria met
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>
                {task.acceptance_criteria}
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmComplete}
                  onChange={e => setConfirm(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--green)' }}
                />
                I confirm the acceptance criteria have been met
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button className="tb-btn" onClick={onClose}>Cancel</button>
          <button
            className="tb-btn primary"
            onClick={handleSave}
            disabled={saving || (isCompleting && !confirmComplete)}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Phase Section ────────────────────────────────────────────────
function PhaseSection({
  phase,
  tasks,
  projectId,
  phases,
  onRefetch,
}: {
  phase: Phase
  tasks: Task[]
  projectId: string
  phases: Phase[]
  onRefetch: () => void
}) {
  const [expanded, setExpanded]         = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const riskIndicator = getPhaseRiskIndicator(tasks)
  const availStyle    = getAvailabilityStyle(phase.data_availability)
  const completeCount = tasks.filter(t => t.completion_status === 'complete').length

  // Sort tasks by risk_number descending within the phase
  const sortedTasks = [...tasks].sort((a, b) => (b.risk_number || 0) - (a.risk_number || 0))

  return (
    <>
      {/* Phase header card */}
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}
      >
        {/* Phase header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '13px 16px',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
            background: expanded ? 'var(--white)' : 'var(--bg)',
            borderBottom: expanded ? '1px solid var(--border)' : 'none',
            transition: 'background 0.15s',
          }}
          onClick={() => setExpanded(e => !e)}
        >
          {/* Expand/collapse chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              flexShrink: 0,
              color: 'var(--text3)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Risk indicator dot */}
          <div
            title={riskIndicator.title}
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: riskIndicator.color,
              flexShrink: 0,
              boxShadow: `0 0 0 2px ${riskIndicator.color}22`,
            }}
          />

          {/* Phase name */}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
            {phase.phase_name}
          </span>

          {/* Date range */}
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}
          >
            {fmt(phase.start_date)} → {fmt(phase.target_date)}
          </span>

          {/* Data availability badge */}
          <span
            className={`status ${availStyle.cls}`}
            style={{ flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {availStyle.text}
          </span>

          {/* Task count */}
          <span
            style={{
              fontSize: 11,
              color: 'var(--text3)',
              background: 'var(--bg2)',
              borderRadius: 99,
              padding: '2px 8px',
              flexShrink: 0,
            }}
          >
            {completeCount}/{tasks.length} done
          </span>

          {/* Add task button (stop propagation so it doesn't toggle expand) */}
          <button
            className="tb-btn primary"
            style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
            onClick={e => {
              e.stopPropagation()
              setShowAddModal(true)
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <line x1="8" y1="3" x2="8" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="8" x2="13" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add Task
          </button>
        </div>

        {/* Task table */}
        {expanded && (
          <>
            {sortedTasks.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px 0',
                  color: 'var(--text4)',
                  fontSize: 12,
                }}
              >
                No tasks in this phase yet.{' '}
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--blue)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font)',
                    textDecoration: 'underline',
                  }}
                  onClick={() => setShowAddModal(true)}
                >
                  Add the first task
                </button>
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ padding: '10px 16px', width: '20%' }}>Task name</th>
                    <th style={{ width: '8%' }}>Control</th>
                    <th style={{ width: '10%' }}>Owner</th>
                    <th style={{ width: '7%' }}>Due date</th>
                    <th style={{ width: '7%' }}>ECD</th>
                    <th style={{ width: '6%' }}>Delay</th>
                    <th style={{ width: '5%' }}>Slips</th>
                    <th style={{ width: '9%' }}>Risk</th>
                    <th style={{ width: '5%' }}>RN</th>
                    <th style={{ width: '9%' }}>Status</th>
                    <th style={{ width: '14%' }}>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map(task => {
                    const { cls: riskCls, text: riskText } = getRiskStyle(task.risk_label)
                    const { cls: stsCls, text: stsText }   = getStatusStyle(task.completion_status)
                    const rn = task.risk_number || 0
                    const ecdDiffers = task.current_ecd && task.current_ecd !== task.planned_end_date
                    const today = new Date().toISOString().split('T')[0]
                    const isOverdue = task.current_ecd
                      && task.current_ecd < today
                      && task.completion_status !== 'complete'

                    return (
                      <tr
                        key={task.task_id}
                        style={{
                          cursor: 'pointer',
                          background: isOverdue ? 'var(--red-bg)' : undefined,
                        }}
                        onClick={() => setSelectedTask(task)}
                      >
                        {/* Task name + criteria */}
                        <td style={{ maxWidth: 220 }}>
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                            {task.task_name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>
                            {task.acceptance_criteria?.substring(0, 55)}
                            {task.acceptance_criteria?.length > 55 ? '…' : ''}
                          </div>
                        </td>

                        {/* Control type */}
                        <td>
                          <span className="tag" style={{ textTransform: 'capitalize', fontSize: 10 }}>
                            {task.control_type.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Owner */}
                        <td>
                          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                            {task.owner_email
                              ? task.owner_email.split('@')[0]
                              : <span style={{ color: 'var(--text4)' }}>—</span>
                            }
                          </div>
                          {task.owner_department && (
                            <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 1 }}>
                              {task.owner_department}
                            </div>
                          )}
                        </td>

                        {/* Due date (planned, locked) */}
                        <td>
                          <span className="mono" style={{ fontSize: 11 }}>
                            {fmt(task.planned_end_date)}
                          </span>
                        </td>

                        {/* ECD — highlight if moved */}
                        <td>
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: ecdDiffers ? 'var(--amber)' : 'var(--text3)',
                              fontWeight: ecdDiffers ? 600 : 400,
                            }}
                          >
                            {fmt(task.current_ecd)}
                          </span>
                        </td>

                        {/* Delay */}
                        <td>
                          {task.delay_days > 0 ? (
                            <span className="mono" style={{ color: 'var(--red)', fontWeight: 600, fontSize: 11 }}>
                              +{task.delay_days}d
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text4)' }}>—</span>
                          )}
                        </td>

                        {/* Slippage count */}
                        <td>
                          {task.slippage_count > 0 ? (
                            <span className="mono" style={{ color: 'var(--red)', fontWeight: 600, fontSize: 11 }}>
                              {task.slippage_count}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text4)' }}>—</span>
                          )}
                        </td>

                        {/* Risk label */}
                        <td>
                          <span className={`status ${riskCls}`}>{riskText}</span>
                        </td>

                        {/* RN (internal, shown for now) */}
                        <td>
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color:
                                rn === 0
                                  ? 'var(--text4)'
                                  : rn >= 100
                                  ? 'var(--red)'
                                  : rn >= 50
                                  ? 'var(--amber)'
                                  : 'var(--blue)',
                            }}
                          >
                            {rn || '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`status ${stsCls}`}>{stsText}</span>
                        </td>

                        {/* Comments */}
                        <td style={{ maxWidth: 160 }}>
                          {task.comments ? (
                            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                              {task.comments.substring(0, 60)}{task.comments.length > 60 ? '…' : ''}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text4)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal
          projectId={projectId}
          phase={phase}
          phases={phases}
          onClose={() => setShowAddModal(false)}
          onSaved={onRefetch}
        />
      )}

      {/* Task Update Panel */}
      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onSaved={() => {
            onRefetch()
            setSelectedTask(null)
          }}
        />
      )}
    </>
  )
}

// ─── Main TasksTab ────────────────────────────────────────────────
export default function TasksTab({
  projectId,
  project,
  tasks,
  refetch,
}: {
  projectId: string
  project: any
  tasks: Task[]
  refetch: () => void
}) {
  const phases: Phase[] = (project?.phases || []).sort(
    (a: Phase, b: Phase) => a.phase_order - b.phase_order
  )

  const totalComplete = tasks.filter(t => t.completion_status === 'complete').length
  const totalDelayed  = tasks.filter(t => t.delay_days > 0).length
  const highRisk      = tasks.filter(t => t.risk_label === 'high_risk').length

  // Group tasks by phase_id
  const tasksByPhase = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    const key = task.phase_id || '__unassigned__'
    if (!acc[key]) acc[key] = []
    acc[key].push(task)
    return acc
  }, {})

  // Unassigned tasks (phase_id is null)
  const unassigned = tasksByPhase['__unassigned__'] || []

  return (
    <div>
      {/* Summary bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 16,
          fontSize: 12,
          color: 'var(--text3)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{tasks.length}</strong>{' '}
          tasks
        </span>
        <span>
          <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{totalComplete}</strong>{' '}
          complete
        </span>
        {totalDelayed > 0 && (
          <span>
            <strong style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{totalDelayed}</strong>{' '}
            delayed
          </span>
        )}
        {highRisk > 0 && (
          <span>
            <strong style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>{highRisk}</strong>{' '}
            high risk
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text4)' }}>
          Click any task row to update
        </span>
      </div>

      {/* Overdue warning banner */}
      {(() => {
        const today = new Date().toISOString().split('T')[0]
        const overdueTasks = tasks.filter(t =>
          t.current_ecd && t.current_ecd < today && t.completion_status !== 'complete'
        )
        if (overdueTasks.length === 0) return null
        return (
          <div className="alert-banner red" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {overdueTasks.length} task{overdueTasks.length > 1 ? 's' : ''} need updating — ECD has passed today
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                {overdueTasks.map((t, i) => (
                  <span key={t.task_id}>
                    <strong>{t.task_name}</strong>
                    {t.phase_name ? ` (${t.phase_name})` : ''}
                    {i < overdueTasks.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* No phases state */}
      {phases.length === 0 && (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 40, color: 'var(--text4)', fontSize: 13 }}
        >
          No phases defined for this project yet.
        </div>
      )}

      {/* Phase sections */}
      {phases.map(phase => (
        <PhaseSection
          key={phase.phase_id}
          phase={phase}
          tasks={tasksByPhase[phase.phase_id] || []}
          projectId={projectId}
          phases={phases}
          onRefetch={refetch}
        />
      ))}

      {/* Unassigned tasks fallback */}
      {unassigned.length > 0 && (
        <PhaseSection
          key="__unassigned__"
          phase={{
            phase_id: '__unassigned__',
            phase_name: 'Unassigned',
            phase_order: 999,
            start_date: '',
            target_date: '',
            data_availability: 'no',
          }}
          tasks={unassigned}
          projectId={projectId}
          phases={phases}
          onRefetch={refetch}
        />
      )}
    </div>
  )
}
