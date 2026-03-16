import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as jose from 'jose'

async function generateDevToken(email: string): Promise<string> {
  const secret = new TextEncoder().encode('test-secret')
  return new jose.SignJWT({
    sub:       '00000000-0000-0000-0000-000000000002',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    role:      'pm',
    email
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(secret)
}

export default function LoginPage() {
  const [email, setEmail]       = useState('yuvaraj@testco.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const token = await generateDevToken(email)
      localStorage.setItem('pp_token', token)
      navigate('/')
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #003366 0%, #0071C5 60%, #00C7FD 100%)' }}>
      {/* Left panel */}
      <div style={{ display: 'none', flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: 48 }} className="left-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9L7 13L15 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>Project Perfect</span>
        </div>
        <div>
          <h2 style={{ color: 'white', fontSize: 40, fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px' }}>
            Intelligent Project<br />Management
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, lineHeight: 1.6 }}>
            AI-powered PPM for manufacturing programmes. Real-time OPV tracking, automated escalations, and predictive delay analysis.
          </p>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>projectperfect.in</p>
      </div>

      {/* Right panel */}
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9L7 13L15 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>Project Perfect</span>
          </div>

          <div style={{ background: 'white', borderRadius: 20, padding: 36, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <h1 style={{ color: '#0d2e47', fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Welcome back</h1>
            <p style={{ color: '#4d88ad', fontSize: 14, margin: '0 0 24px' }}>Sign in to your workspace</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#1a4a6e', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #D0E2F0', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d2e47', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#0071C5'}
                  onBlur={e => e.target.style.borderColor = '#D0E2F0'}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#1a4a6e', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', border: '1.5px solid #D0E2F0', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#0d2e47', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#0071C5'}
                  onBlur={e => e.target.style.borderColor = '#D0E2F0'}
                />
              </div>
              {error && <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={loading}
                style={{ background: 'linear-gradient(135deg, #0071C5, #00C7FD)', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>
                {loading ? 'Signing in...' : 'Sign in →'}
              </button>
            </form>
          </div>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 20 }}>
            Manufacturing IPM Platform · projectperfect.in
          </p>
        </div>
      </div>
    </div>
  )
}
