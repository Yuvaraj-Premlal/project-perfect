import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityAuth, setCommunitySession } from '../../api/community'

const NAVY = '#163B6D'
const BORDER = '#E2E8F0'
const TEXT = '#0F172A'
const TEXT_FAINT = '#94A3B8'
const RED = '#DC2626'

export default function CommunityLogin() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await communityAuth.login(email, password)
      setCommunitySession(res.data.token, res.data.member)
      navigate('/community')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 1.5rem' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: NAVY,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', fontSize: 16, fontWeight: 500, color: '#fff',
            margin: '0 auto 1rem'
          }}>PP</div>
          <div style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 500, color: TEXT, marginBottom: 4 }}>
            Project Perfect Community
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_FAINT, letterSpacing: '.04em' }}>
            Member login
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin} style={{
          background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '1.75rem', boxShadow: '0 1px 3px rgba(22,59,109,0.08)'
        }}>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
              padding: '.65rem .9rem', marginBottom: '1rem',
              fontFamily: 'monospace', fontSize: 11, color: RED
            }}>{error}</div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.4rem' }}>
              Email address
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{
                width: '100%', background: '#F8FAFC', border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: '10px 14px', fontSize: 13.5, color: TEXT,
                fontFamily: 'inherit', outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.4rem' }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{
                width: '100%', background: '#F8FAFC', border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: '10px 14px', fontSize: 13.5, color: TEXT,
                fontFamily: 'inherit', outline: 'none'
              }}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', background: NAVY, border: 'none', color: '#fff',
            fontFamily: 'monospace', fontSize: 11, letterSpacing: '.1em',
            padding: '13px', borderRadius: 6, cursor: 'pointer',
            textTransform: 'uppercase', opacity: loading ? .7 : 1
          }}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_FAINT }}>
              Not a member?{' '}
              <span
                onClick={() => navigate('/community/apply')}
                style={{ color: NAVY, cursor: 'pointer', textDecoration: 'underline' }}
              >Apply to join</span>
            </span>
          </div>
        </form>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT }}>
          <strong style={{ color: NAVY }}>Project Perfect Community</strong> · projectperfect.in/community
        </div>
      </div>
    </div>
  )
}