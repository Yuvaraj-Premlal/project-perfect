import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjects } from '../api/projects'
import PortfolioView from './PortfolioView'
import CreateProjectModal from './CreateProjectModal'
import ProjectView from './ProjectView'
import ProjectLearnings from './ProjectLearnings'
import LearningDetail from './LearningDetail'
import AdminPortal from './AdminPortal'
import APQPTemplatesPage from './APQPTemplatesPage'
import PPAPTemplatesPage from './PPAPTemplatesPage'
import AnalyticsPage from './AnalyticsPage'
import { isApqpEnabled } from '../api/auth'
import { getCurrentUser } from '../api/auth'

function getOPVColor(opv: number) {
  if (opv >= 1.0) return '#0A7E4F'
  if (opv >= 0.8) return '#9A5A00'
  return '#C0392B'
}


export default function AppShell() {
  const apqpEnabled = isApqpEnabled()
  const [view, setView]       = useState<'portfolio' | 'project' | 'learnings' | 'learning-detail' | 'admin' | 'apqp-templates' | 'analytics' | 'ppap-templates'>('portfolio')
  const [activeLearning, setActiveLearning] = useState<string|null>(null)
  const currentUser = getCurrentUser()
  const [showCreate, setShowCreate] = useState(false)
  const [activeProject, setActiveProject] = useState<string | null>(null)

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: getProjects })

  function openProject(id: string) {
    setActiveProject(id)
    setView('project')
  }

  function goPortfolio() {
    setView('portfolio')
    setActiveProject(null)
  }

  const currentProject = projects?.find((p: any) => p.project_id === activeProject)

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5L7.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="logo-text">Project Perfect</div>
            <div className="logo-sub">Intelligent Project Management</div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Main</div>
          <button className={`nav-item ${view==='portfolio' && !activeProject ? 'active' : ''}`} onClick={goPortfolio}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="2" width="5" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="7" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2" y="10" width="5" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
            Portfolio
          </button>
          <button className={`nav-item ${view==='learnings'||view==='learning-detail' ? 'active' : ''}`} onClick={() => { setView('learnings'); setActiveProject(null) }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            Project Learnings
          </button>

          {(currentUser?.role === 'portfolio_manager' || currentUser?.role === 'super_user') && (
            <button className={`nav-item ${view==='analytics' ? 'active' : ''}`} onClick={() => { setView('analytics'); setActiveProject(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 16l4-6 4 4 4-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>Analytics Engine</span>
            </button>
          )}
          {apqpEnabled && (currentUser?.role === 'portfolio_manager' || currentUser?.role === 'super_user') && (
            <button className={`nav-item ${view==='ppap-templates' ? 'active' : ''}`} onClick={() => { setView('ppap-templates'); setActiveProject(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5"/><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span>PPAP Templates</span>
            </button>
          )}
          {apqpEnabled && (currentUser?.role === 'portfolio_manager' || currentUser?.role === 'super_user') && (
            <button className={`nav-item ${view==='apqp-templates' ? 'active' : ''}`} onClick={() => { setView('apqp-templates'); setActiveProject(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>APQP Templates</span>
            </button>
          )}
          {currentUser?.role === 'super_user' && (
            <button className={`nav-item ${view==='admin' ? 'active' : ''}`} onClick={() => { setView('admin'); setActiveProject(null) }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 13c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              Admin
            </button>
          )}
        </div>

        <div className="nav-section">
          <div className="nav-label">Active Projects</div>
        </div>
        <div className="proj-list">
          {projects?.map((p: any) => {
            const opv   = parseFloat(p.opv)
            const color = getOPVColor(opv)
            return (
              <button key={p.project_id} className={`proj-item ${activeProject === p.project_id ? 'active' : ''}`}
                onClick={() => openProject(p.project_id)}>
                <div className="proj-dot" style={{ background: color }} />
                <span className="proj-name-text">{p.project_name}</span>
              </button>
            )
          })}
          {!projects?.length && (
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', padding:'4px 10px' }}>No projects yet</div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="avatar">{currentUser?.email?.slice(0,2).toUpperCase() || 'U'}</div>
          <div>
            <div className="user-name">{currentUser?.name || currentUser?.email || 'User'}</div>
            <div className="user-role" style={{ textTransform:'capitalize' }}>{currentUser?.role?.replace(/_/g,' ') || 'Project Manager'}</div>
          </div>
          <button onClick={() => { localStorage.removeItem('pp_token'); window.location.href='/login' }}
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:18 }} title="Sign out">
            ⎋
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="main">
        <div className="topbar">
          <div className="breadcrumb">
            {view === 'portfolio' ? (
              <span>Portfolio</span>
            ) : view === 'analytics' ? (
              <span>Analytics Engine</span>
            ) : view === 'ppap-templates' ? (
              <span>PPAP Templates</span>
            ) : view === 'apqp-templates' ? (
              <span>APQP Templates</span>
            ) : view === 'admin' ? (
              <span>Admin Portal</span>
            ) : view === 'learnings' ? (
              <span>Project Learnings</span>
            ) : view === 'learning-detail' ? (
              <><span style={{ cursor:'pointer' }} onClick={() => setView('learnings')}>Project Learnings</span><span className="sep"> &gt; </span><span className="current">Case Study</span></>
            ) : (
              <>
                <span style={{ cursor:'pointer' }} onClick={goPortfolio}>Portfolio</span>
                <span className="sep"> &gt; </span>
                <span className="current">{currentProject?.project_name || '...'}</span>
              </>
            )}
          </div>
          <div className="tb-right">
            {view === 'project' && (
              <button className="tb-btn" onClick={goPortfolio}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="2" width="5" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="7" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2" y="10" width="5" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Portfolio
              </button>
            )}
            <button className="tb-btn primary" onClick={()=>setShowCreate(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><line x1="8" y1="3" x2="8" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
              New Project
            </button>
          </div>
        </div>

        <div className="content">
          {view === 'portfolio'        && <PortfolioView projects={projects || []} onOpenProject={openProject} />}
          {view === 'project'          && <ProjectView projectId={activeProject!} />}
          {view === 'learnings'        && <ProjectLearnings onOpenLearning={(id) => { setActiveLearning(id); setView('learning-detail') }} />}
          {view === 'learning-detail'  && <LearningDetail reportId={activeLearning!} onBack={() => setView('learnings')} />}
          {view === 'admin'           && <AdminPortal />}
          {view === 'apqp-templates'   && <APQPTemplatesPage />}
          {view === 'ppap-templates'   && <PPAPTemplatesPage />}
          {view === 'analytics'          && <AnalyticsPage />}
        </div>
      </div>

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { setShowCreate(false); openProject(id) }}
      />
    </div>
  )
}
