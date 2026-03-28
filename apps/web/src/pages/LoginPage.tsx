import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as jose from 'jose'

async function generateDevToken(email: string, role: string = 'pm'): Promise<string> {
  const secret = new TextEncoder().encode('test-secret')
  return new jose.SignJWT({
    sub: '00000000-0000-0000-0000-000000000002',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    role, email
  }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').setIssuedAt().sign(secret)
}

export default function LoginPage() {
  const [email, setEmail]       = useState('yuvaraj@testco.com')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('super_user')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      localStorage.setItem('pp_token', await generateDevToken(email, role))
      navigate('/')
    } catch { setError('Login failed.') } finally { setLoading(false) }
  }

  return (
    <div className="login-wrap" style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:28, width:'100%', maxWidth:420, padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div className="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8a5 5 0 1 1 10 0A5 5 0 0 1 3 8z" fill="none" stroke="white" strokeWidth="1.5"/>
              <path d="M8 5v3l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
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
              <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error && <div style={{ color:'var(--red)', fontSize:12 }}>{error}</div>}
            <button type="submit" className="tb-btn primary" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'10px 14px', fontSize:13, marginTop:4 }}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>
        </div>

        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11 }}>projectperfect.in · Manufacturing IPM</div>
      </div>
    </div>
  )
}
