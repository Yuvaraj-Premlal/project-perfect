import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('pp_token', res.data.token)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap" style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:28, width:'100%', maxWidth:420, padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div className="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5L7.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="logo-text" style={{ color:'white', fontSize:18 }}>Project Perfect</div>
            <div className="logo-sub">IPM Platform</div>
          </div>
        </div>

        <div className="login-card">
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Sign in</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>Access your project workspace</div>
          </div>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required
                placeholder="you@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required
                placeholder="Enter your password" autoComplete="current-password" />
            </div>
            {error && (
              <div style={{ color:'var(--red)', fontSize:12, background:'var(--red-bg)',
                borderRadius:6, padding:'8px 12px' }}>{error}</div>
            )}
            <button type="submit" className="tb-btn primary" disabled={loading}
              style={{ width:'100%', justifyContent:'center', padding:'10px 14px', fontSize:13, marginTop:4 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <a href="https://www.projectperfect.in" target="_blank" rel="noreferrer"
          style={{ color:'rgba(255,255,255,0.35)', fontSize:11, textDecoration:'none' }}>
          www.projectperfect.in
        </a>
      </div>
    </div>
  )
}
