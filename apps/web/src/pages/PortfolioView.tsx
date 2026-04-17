// @ts-ignore
import { useState } from 'react'

function getStatusCls(opv: number, lfv: number): { cls: string, text: string } {
  if (opv < 0.8 || lfv > 1.2) return { cls: 'red',   text: 'Out of control' }
  if (opv < 0.9 || lfv > 1.1) return { cls: 'amber', text: 'High risk' }
  if (opv < 1.0 || lfv > 1.0) return { cls: 'blue',  text: 'Monitoring' }
  return { cls: 'green', text: 'On track' }
}

function monoColor(val: number, thresholdGood: number, thresholdBad: number, higherIsBetter = true): string {
  if (higherIsBetter) {
    if (val >= thresholdGood) return 'var(--green)'
    if (val <= thresholdBad)  return 'var(--red)'
    return 'var(--amber)'
  } else {
    if (val <= thresholdGood) return 'var(--green)'
    if (val >= thresholdBad)  return 'var(--red)'
    return 'var(--amber)'
  }
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type SortKey = 'project' | 'opv' | 'lfv' | 'planned_duration' | 'ecd' | 'expected_delay' | 'delay_pct' | 'status'

export default function PortfolioView({ projects, onOpenProject }: { projects: any[], onOpenProject: (id: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('delay_pct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const highRisk = projects.filter((p: any) => parseFloat(p.opv) < 0.8)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function getSortValue(p: any, key: SortKey): number | string {
    const opv = parseFloat(p.opv)
    const lfv = parseFloat(p.lfv)
    const delayPct = Math.max(0, (1 - opv) * 100)
    const plannedEnd = p.planned_end_date ? new Date(p.planned_end_date).getTime() : 0
    const ecd = p.ecd_algorithmic ? new Date(p.ecd_algorithmic).getTime() : plannedEnd
    const expectedDelayDays = Math.max(0, Math.round((ecd - plannedEnd) / 86400000))
    const plannedStart = p.start_date ? new Date(p.start_date).getTime() : 0
    const plannedDuration = plannedEnd - plannedStart
    switch (key) {
      case 'project':          return p.project_name?.toLowerCase() || ''
      case 'opv':              return opv
      case 'lfv':              return lfv
      case 'planned_duration': return plannedDuration
      case 'expected_delay':   return expectedDelayDays
      case 'ecd':             return p.ecd_algorithmic ? new Date(p.ecd_algorithmic).getTime() : 0
      case 'delay_pct':        return delayPct
      case 'status':           return delayPct
      default:                 return 0
    }
  }

  const sorted = [...projects].sort((a, b) => {
    const av = getSortValue(a, sortKey)
    const bv = getSortValue(b, sortKey)
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function SortTh({ label, col, style }: { label: string, col: SortKey, style?: React.CSSProperties }) {
    const active = sortKey === col
    return (
      <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }} onClick={() => handleSort(col)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ fontSize: 9, color: active ? 'var(--blue)' : 'var(--text4)', fontWeight: 700 }}>
            {active ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
          </span>
        </span>
      </th>
    )
  }

  if (projects.length === 0) return (
    <div style={{ textAlign:"center", padding:80, color:"var(--text4)", fontSize:13 }}>
      <div style={{ fontSize:16, fontWeight:600, marginBottom:8, color:"var(--text3)" }}>No projects yet</div>
      <div>You have no active projects assigned to you.</div>
    </div>
  )
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Active Portfolio</div>
        <div className="page-sub">{projects.length} projects · {highRisk.length} requiring attention</div>
      </div>

      {highRisk.length > 0 && (
        <div className="alert-banner red">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><line x1="8" y1="7" x2="8" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="12" r="0.7" fill="currentColor"/></svg>
          <span><strong>Escalation alert —</strong> {highRisk.map((p:any)=>p.project_name).join(' and ')} {highRisk.length===1?'has':'have'} OPV below 0.8. Leadership review required.</span>
        </div>
      )}

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <SortTh label="Project"          col="project"          style={{ padding:'12px 14px' }} />
              <SortTh label="OPV"              col="opv" />
              <SortTh label="LFV"              col="lfv" />
              <SortTh label="Planned Duration" col="planned_duration" />
              <SortTh label="ECD"              col="ecd" />
              <SortTh label="Expected Delay"   col="expected_delay" />
              <SortTh label="Delay %"          col="delay_pct" />
              <SortTh label="Status"           col="status" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--text4)' }}>No active projects</td></tr>
            )}
            {sorted.map((p: any) => {
              const opv = parseFloat(p.opv)
              const lfv = parseFloat(p.lfv)
              const delayPct = Math.max(0, (1 - opv) * 100)
              const plannedEnd = p.planned_end_date ? new Date(p.planned_end_date) : null
              const ecd = p.ecd_algorithmic ? new Date(p.ecd_algorithmic) : null
              const expectedDelayDays = plannedEnd && ecd ? Math.max(0, Math.round((ecd.getTime() - plannedEnd.getTime()) / 86400000)) : 0
              const { cls, text } = getStatusCls(opv, lfv)
              return (
                <tr key={p.project_id} onClick={() => onOpenProject(p.project_id)} style={{ cursor:'pointer' }}>
                  <td>
                    <span style={{ color:'var(--text)', fontWeight:500 }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color='var(--blue)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color='var(--text)'}>
                      {p.project_name}
                    </span>
                    <div style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{p.customer_name} · {p.project_code}</div>
                  </td>
                  <td><span className="mono" style={{ color: monoColor(opv, 1.0, 0.8), fontWeight:600 }}>{opv.toFixed(2)}</span></td>
                  <td><span className="mono" style={{ color: monoColor(lfv, 1.0, 1.2, false), fontWeight:600 }}>{lfv.toFixed(2)}</span></td>
                  <td>
                    <span className="mono" style={{ fontSize:11, whiteSpace:'nowrap' }}>
                      {fmt(p.start_date)}<span style={{ color:'var(--text4)', margin:'0 3px' }}>→</span>{fmt(p.planned_end_date)}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize:11, color: expectedDelayDays > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {ecd ? ecd.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </span>
                  </td>
                  <td>
                    {expectedDelayDays > 0
                      ? <span className="mono" style={{ color:'var(--red)', fontWeight:600 }}>+{expectedDelayDays}d</span>
                      : <span style={{ color:'var(--text4)' }}>—</span>}
                  </td>
                  <td><span className={`status ${cls}`}>{delayPct.toFixed(0)}%</span></td>
                  <td><span className={`status ${cls}`}>{text}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {projects.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Portfolio Gantt</div>
              <div className="card-sub">Blue = planned duration · Orange = delay extension · Vertical line = today</div>
            </div>
          </div>
          <div style={{ overflowX:"auto", overflowY:"hidden", paddingBottom:8 }}>
          <div className="gantt-months" style={{ minWidth:800 }}>
            {(() => {
              const allStarts = sorted.map((x:any) => new Date(x.start_date).getTime())
              const rStart    = new Date(Math.min(...allStarts)); rStart.setMonth(0,1)
              const rEnd      = new Date(rStart); rEnd.setMonth(rEnd.getMonth() + 24)
              const months    = []
              const cur       = new Date(rStart)
              while (cur <= rEnd) {
                months.push(cur.toLocaleDateString('en-GB', { month:'short', year: cur.getFullYear() !== rStart.getFullYear() ? '2-digit' : undefined }))
                cur.setMonth(cur.getMonth() + 1)
              }
              return months.map(m => <div key={m} className="gantt-month">{m}</div>)
            })()}
          </div>
          <div>
            {sorted.map((p: any) => {
              const start      = new Date(p.start_date)
              const end        = new Date(p.planned_end_date)
              const ecd        = p.ecd_algorithmic ? new Date(p.ecd_algorithmic) : end
              const hasDelay   = ecd > end

              // Cap timeline at 24 months from earliest project start
              const allStarts  = sorted.map((x:any) => new Date(x.start_date).getTime())
              const rangeStart = new Date(Math.min(...allStarts))
              rangeStart.setMonth(0, 1)
              const rangeEnd   = new Date(rangeStart)
              rangeEnd.setMonth(rangeEnd.getMonth() + 24)

              // Check if ECD exceeds the 24-month cap
              const isTruncated = hasDelay && ecd > rangeEnd
              const displayECD  = isTruncated ? rangeEnd : ecd

              const total      = rangeEnd.getTime() - rangeStart.getTime()
              const left       = Math.max(0, (start.getTime() - rangeStart.getTime()) / total * 100)
              const width      = Math.min(100 - left, (end.getTime() - start.getTime()) / total * 100)
              const delayW     = hasDelay ? Math.min(100 - left - width, (displayECD.getTime() - end.getTime()) / total * 100) : 0
              const delayDays  = hasDelay ? Math.round((ecd.getTime() - end.getTime()) / 86400000) : 0
              const today      = Math.min(100, Math.max(0, (new Date().getTime() - rangeStart.getTime()) / total * 100))

              return (
                <div key={p.project_id} className="gantt-row">
                  <div className="gantt-label" style={{ fontWeight:500 }}>{p.project_name}</div>
                  <div className="gantt-track">
                    <div className="gantt-today" style={{ left:`${today}%` }} />
                    <div className="gantt-bar planned" style={{ left:`${left}%`, width:`${width}%` }}>Planned</div>
                    {hasDelay && (
                      <div className="gantt-bar delay" style={{ left:`${left+width}%`, width:`${delayW}%`, display:'flex', alignItems:'center', justifyContent:'space-between', paddingRight: isTruncated ? 4 : undefined }}>
                        <span>+{delayDays}d</span>
                        {isTruncated && <span style={{ fontSize:13, fontWeight:700, letterSpacing:1 }}>»</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
