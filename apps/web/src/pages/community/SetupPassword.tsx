import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { communityAuth } from '../../api/community'

const NAVY = '#163B6D'
const BORDER = '#E2E8F0'
const TEXT = '#0F172A'
const TEXT_FAINT = '#94A3B8'
const RED = '#DC2626'

export default function CommunitySetupPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link. Please contact Yuvaraj.')
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await communityAuth.setupPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/community/login'), 2000)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 1.5rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: NAVY,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', fontSize: 16, fontWeight: 500, color: '#fff',
            margin: '0 auto 1rem'
          }}>PP</div>
          <div style={{ fontFamily: 'serif', fontSize: 22, fontWeight: 500, color: TEXT, marginBottom: 4 }}>
            Welcome to the Community
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_FAINT, letterSpacing: '.04em' }}>
            Set your password to activate your account
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '1.75rem', boxShadow: '0 1px 3px rgba(22,59,109,0.08)'
        }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: 36, marginBottom: '.75rem' }}>✓</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#059669' }}>
                Password set successfully. Redirecting to login...
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
                  padding: '.65rem .9rem', marginBottom: '1rem',
                  fontFamily: 'monospace', fontSize: 11, color: RED
                }}>{error}</div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.4rem' }}>
                  New password
                </label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  style={{ width: '100%', background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', fontSize: 13.5, color: TEXT, fontFamily: 'inherit', outline: 'none' }}
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.4rem' }}>
                  Confirm password
                </label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required
                  style={{ width: '100%', background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', fontSize: 13.5, color: TEXT, fontFamily: 'inherit', outline: 'none' }}
                  placeholder="Repeat your password"
                />
              </div>

              <button type="submit" disabled={loading || !token} style={{
                width: '100%', background: NAVY, border: 'none', color: '#fff',
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '.1em',
                padding: '13px', borderRadius: 6, cursor: 'pointer',
                textTransform: 'uppercase', opacity: loading ? .7 : 1
              }}>
                {loading ? 'Setting up...' : 'Activate Account →'}
              </button>
            </>
          )}
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT }}>
          <strong style={{ color: NAVY }}>Project Perfect Community</strong> · projectperfect.in/community
        </div>
      </div>
    </div>
  )
}