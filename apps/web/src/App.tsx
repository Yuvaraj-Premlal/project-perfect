import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = localStorage.getItem('pp_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
    </Routes>
  )
}
