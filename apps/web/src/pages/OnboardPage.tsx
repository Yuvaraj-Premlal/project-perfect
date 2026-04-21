import React, { useState } from 'react'
import { api } from '../api/client'

export default function OnboardPage() {
  const [secret, setSecret]       = useState('')
  const [orgName, setOrgName]     = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPass, setAdminPass] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<any>(null)
  const [apqpEnabled, setApqpEnabled] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await api.post('/onboard',
        { org_name: orgName, admin_name: adminName, apqp_enabled: apqpEnabled,
          admin_email: adminEmail, admin_password: adminPass },
        { headers: { 'x-platform-secret': secret } }
      )
      setResult(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Onboarding failed')
    } finally {
      setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0C1B35', display:'flex',
      alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:480 }}>
        <div style={{ marginBottom:24, textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:4 }}>
            Project Perfect
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>
            Platform Admin - New Client Onboarding
          </div>
        </div>

        {result ? (
          <div style={{ background:'white', borderRadius:12, padding:28 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#0A7E4F', marginBottom:16 }}>
              Client onboarded successfully
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13 }}>
              <div><b>Organisation:</b> {result.org_name}</div>
              <div><b>Tenant ID:</b> <code style={{ fontSize:11, background:'#f1f5f9',
                padding:'2px 6px', borderRadius:4 }}>{result.tenant_id}</code></div>
              <div><b>Super User:</b> {result.super_user.full_name}</div>
              <div><b>Login email:</b> {result.super_user.email}</div>
              <div style={{ marginTop:8, padding:'10px 14px', background:'#eff6ff',
                borderRadius:8, fontSize:12, color:'#1A3A6B' }}>
                Share these credentials with the client. Ask them to change their
                password after first login.
              </div>
            </div>
            <button style={{ marginTop:20, width:'100%', padding:'10px', borderRadius:8,
              background:'#2563EB', color:'white', border:'none', cursor:'pointer', fontSize:13 }}
              onClick={() => { setResult(null); setOrgName(''); setAdminName('');
                setAdminEmail(''); setAdminPass(''); }}>
              Onboard another client
            </button>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:12, padding:28 }}>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Platform Secret</label>
                <input className="form-input" type="password" value={secret}
                  onChange={e => setSecret(e.target.value)} required
                  placeholder="Platform admin secret key" />
              </div>
              <hr style={{ border:'none', borderTop:'1px solid #e2e8f0', margin:'4px 0' }} />
              <div className="form-group">
                <label className="form-label">Organisation Name</label>
                <input className="form-input" value={orgName}
                  onChange={e => setOrgName(e.target.value)} required
                  placeholder="e.g. Acme Manufacturing Ltd" />
              </div>
              <div className="form-group">
                <label className="form-label">Super User Full Name</label>
                <input className="form-input" value={adminName}
                  onChange={e => setAdminName(e.target.value)} required
                  placeholder="e.g. John Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Super User Email</label>
                <input className="form-input" type="email" value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)} required
                  placeholder="john@acme.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Password</label>
                <input className="form-input" type="password" value={adminPass}
                  onChange={e => setAdminPass(e.target.value)} required
                  placeholder="Min 8 characters" />
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderTop:'1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'#0F172A' }}>Include APQP Tracking?</div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>Enable APQP quality process tracking for this organisation</div>
                </div>
                <div onClick={() => setApqpEnabled(p => !p)}
                  style={{ width:40, height:22, borderRadius:11, background: apqpEnabled ? '#0F62FE' : '#E2E8F0', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: apqpEnabled ? 21 : 3, transition:'left .2s' }} />
                </div>
              </div>
              {error && (
                <div style={{ color:'#C0392B', fontSize:12, background:'#FEF2F2',
                  borderRadius:6, padding:'8px 12px' }}>{error}</div>
              )}
              <button type="submit" disabled={loading}
                style={{ padding:'10px', borderRadius:8, background:'#2563EB',
                  color:'white', border:'none', cursor:'pointer', fontSize:13, marginTop:4 }}>
                {loading ? 'Creating...' : 'Create Client Account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
