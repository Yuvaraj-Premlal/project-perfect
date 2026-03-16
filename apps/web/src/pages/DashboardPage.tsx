import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getProjects } from '../api/projects'

function getRiskStyle(tier: string) {
  if (tier === 'high')     return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' }
  if (tier === 'moderate') return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' }
  return { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' }
}

function getOPVColor(opv: number) {
  if (opv >= 0.8) return '#059669'
  if (opv >= 0.5) return '#D97706'
  return '#DC2626'
}

function OPVBar({ value }: { value: number }) {
  const pct   = Math.min(100, Math.round(value * 100))
  const color = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626'
  return (
    <div style={{ background: '#EAF1F8', borderRadius: 99, height: 4, marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: 4, borderRadius: 99, background: color, transition: 'width 0.4s' }} />
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f8fc' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #D0E2F0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0071C5, #00C7FD)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M3 9L7 13L15 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, color: '#0d2e47', fontSize: 15 }}>Project Perfect</span>
        </div>
        <button onClick={() => { localStorage.removeItem('pp_token'); navigate('/login') }}
          style={{ color: '#4d88ad', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0d2e47', margin: 0 }}>Active Projects</h1>
            <p style={{ fontSize: 13, color: '#4d88ad', margin: '4px 0 0' }}>
              {projects?.length ?? 0} project{projects?.length !== 1 ? 's' : ''} in progress
            </p>
          </div>
          <button onClick={() => alert('Create Project — coming next!')}
            style={{ background: 'linear-gradient(135deg, #0071C5, #00C7FD)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            + New Project
          </button>
        </div>

        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: 'white', borderRadius: 16, border: '1px solid #D0E2F0', padding: 20 }}>
                <div style={{ height: 16, background: '#EAF1F8', borderRadius: 6, width: '60%', marginBottom: 12 }} />
                <div style={{ height: 12, background: '#EAF1F8', borderRadius: 6, width: '40%', marginBottom: 16 }} />
                <div style={{ height: 4,  background: '#EAF1F8', borderRadius: 99 }} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && projects?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ color: '#4d88ad', fontSize: 14 }}>No projects yet. Create your first project.</p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {projects.map((p: any) => {
              const risk = getRiskStyle(p.risk_tier)
              const opv  = parseFloat(p.opv)
              const mom  = parseFloat(p.momentum)
              return (
                <div key={p.project_id}
                  onClick={() => navigate(`/projects/${p.project_id}`)}
                  style={{ background: 'white', borderRadius: 16, border: '1px solid #D0E2F0', padding: 20, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#0071C5'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,113,197,0.12)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#D0E2F0'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>

                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #0071C5, #00C7FD)' }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontWeight: 700, color: '#0d2e47', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</h3>
                      <p style={{ color: '#4d88ad', fontSize: 12, margin: '3px 0 0' }}>{p.customer_name} · {p.project_code}</p>
                    </div>
                    <span style={{ background: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0, marginLeft: 8, textTransform: 'capitalize' }}>
                      {p.risk_tier}
                    </span>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#4d88ad', fontWeight: 600 }}>OPV</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: getOPVColor(opv) }}>
                          {(opv * 100).toFixed(1)}%
                        </span>
                        <span style={{ fontSize: 14, color: mom > 0 ? '#059669' : mom < 0 ? '#DC2626' : '#94a3b8' }}>
                          {mom > 0 ? '↑' : mom < 0 ? '↓' : '→'}
                        </span>
                      </div>
                    </div>
                    <OPVBar value={opv} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #EAF1F8' }}>
                    <span style={{ fontSize: 11, color: '#4d88ad' }}>PM: <span style={{ color: '#0d2e47', fontWeight: 600 }}>{p.pm_name || '—'}</span></span>
                    <span style={{ fontSize: 11, color: '#4d88ad' }}>Review: <span style={{ color: '#0d2e47', fontWeight: 600 }}>
                      {p.next_review_due ? new Date(p.next_review_due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </span></span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
