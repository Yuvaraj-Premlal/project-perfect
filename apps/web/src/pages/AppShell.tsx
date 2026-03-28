import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjects } from '../api/projects'
import PortfolioView from './PortfolioView'
import CreateProjectModal from './CreateProjectModal'
import ProjectView from './ProjectView'
import ProjectLearnings from './ProjectLearnings'
import LearningDetail from './LearningDetail'

function getOPVColor(opv: number) {
  if (opv >= 1.0) return '#0A7E4F'
  if (opv >= 0.8) return '#9A5A00'
  return '#C0392B'
}


export default function AppShell() {
  const [view, setView]       = useState<'portfolio' | 'project' | 'learnings' | 'learning-detail'>('portfolio')
  const [activeLearning, setActiveLearning] = useState<string|null>(null)
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
              <path d="M3 8a5 5 0 1 1 10 0A5 5 0 0 1 3 8z" fill="none" stroke="white" strokeWidth="1.5"/>
              <path d="M8 5v3l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="logo-text">Project Perfect</div>
            <div className="logo-sub">IPM Platform</div>
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
          <div className="avatar">YP</div>
          <div>
            <div className="user-name">Yuvaraj P.</div>
            <div className="user-role">Project Manager</div>
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
            ) : view === 'learnings' ? (
              <span>Project Learnings</span>
            ) : view === 'learning-detail' ? (
              <><span style={{ cursor:'pointer' }} onClick={() => setView('learnings')}>Project Learnings</span><span className="sep"> › </span><span className="current">Case Study</span></>
            ) : (
              <>
                <span style={{ cursor:'pointer' }} onClick={goPortfolio}>Portfolio</span>
                <span className="sep"> › </span>
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
