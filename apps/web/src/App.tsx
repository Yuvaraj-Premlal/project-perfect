import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'
import OnboardPage from './pages/OnboardPage'
import CommunityFeed from './pages/community/Feed'
import CommunityLogin from './pages/community/Login'
import CommunityApply from './pages/community/Apply'
import CommunitySetupPassword from './pages/community/SetupPassword'
import CrisisBoard from './pages/community/CrisisBoard'
import PlaybookPage from './pages/community/Playbook'
import EventsPage from './pages/community/Events'
import WeeklyQuestion from './pages/community/WeeklyQuestion'
import ProfilePage from './pages/community/Profile'
import AdminDashboard from './pages/community/AdminDashboard'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = localStorage.getItem('pp_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

function RequireCommunityAuth({ children }: { children: React.ReactElement }) {
  const token = localStorage.getItem('pp_community_token')
  if (!token) return <Navigate to="/community/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Project Perfect routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboard" element={<OnboardPage />} />
      <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />

      {/* Community public routes */}
      <Route path="/community/login" element={<CommunityLogin />} />
      <Route path="/community/apply" element={<CommunityApply />} />
      <Route path="/community/setup-password" element={<CommunitySetupPassword />} />

      {/* Community protected routes */}
      <Route path="/community" element={<RequireCommunityAuth><CommunityFeed /></RequireCommunityAuth>} />
      <Route path="/community/feed" element={<RequireCommunityAuth><CommunityFeed /></RequireCommunityAuth>} />
      <Route path="/community/crisis" element={<RequireCommunityAuth><CrisisBoard /></RequireCommunityAuth>} />
      <Route path="/community/playbook" element={<RequireCommunityAuth><PlaybookPage /></RequireCommunityAuth>} />
      <Route path="/community/events" element={<RequireCommunityAuth><EventsPage /></RequireCommunityAuth>} />
      <Route path="/community/weekly-question" element={<RequireCommunityAuth><WeeklyQuestion /></RequireCommunityAuth>} />
      <Route path="/community/profile" element={<RequireCommunityAuth><ProfilePage /></RequireCommunityAuth>} />
      <Route path="/community/admin" element={<RequireCommunityAuth><AdminDashboard /></RequireCommunityAuth>} />
    </Routes>
  )
}