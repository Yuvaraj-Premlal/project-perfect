import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'
import OnboardPage from './pages/OnboardPage'
import CommunityFeed from './pages/community/Feed'
import CommunityLogin from './pages/community/Login'
import CommunityApply from './pages/community/Apply'
import CommunitySetupPassword from './pages/community/SetupPassword'

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
    </Routes>
  )
}
