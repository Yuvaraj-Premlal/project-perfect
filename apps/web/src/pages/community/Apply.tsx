import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApplications } from '../../api/community'

const NAVY = '#163B6D'
const BORDER = '#E2E8F0'
const TEXT = '#0F172A'
const TEXT_FAINT = '#94A3B8'
const TEXT_LIGHT = '#64748B'
const RED = '#DC2626'

const SECTORS = ['Auto Ancillary','Precision Engineering','Capital Goods','Process Manufacturing','Construction / EPC','General Manufacturing','Other']
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria',
  'Cambodia','Canada','Chile','China','Colombia','Croatia','Czech Republic',
  'Denmark','Ecuador','Egypt','Estonia','Ethiopia','Finland','France','Georgia',
  'Germany','Ghana','Greece','Guatemala','Hungary','India','Indonesia','Iran',
  'Iraq','Ireland','Israel','Italy','Japan','Jordan','Kazakhstan','Kenya',
  'Kuwait','Latvia','Lebanon','Lithuania','Luxembourg','Malaysia','Mexico',
  'Morocco','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan',
  'Panama','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia',
  'Saudi Arabia','Serbia','Singapore','Slovakia','South Africa','South Korea',
  'Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Tunisia',
  'Turkey','UAE','Ukraine','United Kingdom','United States','Uruguay',
  'Venezuela','Vietnam','Other'
]
const ROLES = ['VP Operations / Plant Head','Senior Project Manager','Programme Director','Manufacturing Consultant','Operations Director','Other senior ops role']

export default function CommunityApply() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', email: '', role: '', company_name: '',
    company_sector: '', country: '', linkedin_url: '', qualifying_answer: ''
  })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [submitted, setSubmitted] = useState(false)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function wordCount(text: string) {
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const wc = wordCount(form.qualifying_answer)
    if (wc < 30) { setError('Please be more specific in your answer — minimum 30 words'); return }
    setLoading(true)
    try {
      await communityApplications.apply(form)
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: '#F8FAFC', border: `1px solid ${BORDER}`,
    borderRadius: 6, padding: '10px 14px', fontSize: 13.5, color: TEXT,
    fontFamily: 'inherit', outline: 'none'
  }

  const labelStyle = {
    display: 'block', fontFamily: 'monospace', fontSize: 10,
    color: TEXT_FAINT, letterSpacing: '.08em', textTransform: 'uppercase' as const,
    marginBottom: '.4rem'
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 1.5rem' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>✓</div>
          <div style={{ fontFamily: 'serif', fontSize: 28, fontWeight: 500, color: TEXT, marginBottom: '.75rem' }}>
            Application received.
          </div>
          <div style={{ fontSize: 15, color: TEXT_LIGHT, lineHeight: 1.8, marginBottom: '2rem' }}>
            Thank you for applying. We review every application personally.<br />
            You'll hear from <strong>Yuvaraj Premlal</strong> within 1–2 weeks.
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT_FAINT }}>
            Project Perfect Community · projectperfect.in/community
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem' }}>

        {/* HERO */}
        <div style={{
          background: NAVY, borderRadius: 12, padding: '1.75rem',
          marginBottom: '1.5rem', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '.5rem' }}>
            Founding Cohort · Invite Only · 50 Members
          </div>
          <div style={{ fontFamily: 'serif', fontSize: 26, fontWeight: 500, color: '#fff', marginBottom: '.5rem', lineHeight: 1.2 }}>
            Apply to join the Project Perfect Community
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>
            For manufacturing ops leaders who are done managing projects on hope. We review every application personally. You'll hear from Yuvaraj within 1–2 weeks.
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{
          background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: '1.75rem', boxShadow: '0 1px 3px rgba(22,59,109,0.08)'
        }}>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
              padding: '.65rem .9rem', marginBottom: '1.25rem',
              fontFamily: 'monospace', fontSize: 11, color: RED
            }}>{error}</div>
          )}

          {/* About you */}
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: NAVY, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.85rem', paddingBottom: '.4rem', borderBottom: `1px solid #EBF1FB`, fontWeight: 500 }}>
            About you
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Full name <span style={{ color: RED }}>*</span></label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder="Your full name" />
            </div>
            <div>
              <label style={labelStyle}>Country <span style={{ color: RED }}>*</span></label>
              <select required value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Role / Designation <span style={{ color: RED }}>*</span></label>
              <select required value={form.role} onChange={e => set('role', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Select role</option>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Company sector <span style={{ color: RED }}>*</span></label>
              <select required value={form.company_sector} onChange={e => set('company_sector', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Select sector</option>
                {SECTORS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Company name <span style={{ color: RED }}>*</span></label>
              <input required value={form.company_name} onChange={e => set('company_name', e.target.value)} style={inputStyle} placeholder="Your organisation" />
            </div>
            <div>
              <label style={labelStyle}>Email address <span style={{ color: RED }}>*</span></label>
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="For your invite link" />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>LinkedIn profile URL <span style={{ color: RED }}>*</span></label>
            <input required value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} style={inputStyle} placeholder="linkedin.com/in/yourprofile" />
          </div>

          {/* Qualifying question */}
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: NAVY, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.85rem', paddingBottom: '.4rem', borderBottom: `1px solid #EBF1FB`, fontWeight: 500 }}>
            Your experience
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>
              Tell us about a moment in your career when better project visibility would have changed the outcome <span style={{ color: RED }}>*</span>
            </label>
            <textarea
              required value={form.qualifying_answer}
              onChange={e => set('qualifying_answer', e.target.value)}
              placeholder="Be specific — what was the project, what was the gap in visibility, what happened, what did you learn? The more specific your answer, the better we understand whether this community is the right fit."
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: wordCount(form.qualifying_answer) < 30 ? RED : '#059669', marginTop: 4, textAlign: 'right' }}>
              {wordCount(form.qualifying_answer)} words {wordCount(form.qualifying_answer) < 30 ? '(minimum 30)' : '✓'}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', background: NAVY, border: 'none', color: '#fff',
            fontFamily: 'monospace', fontSize: 11, letterSpacing: '.1em',
            padding: '14px', borderRadius: 6, cursor: 'pointer',
            textTransform: 'uppercase', opacity: loading ? .7 : 1
          }}>
            {loading ? 'Submitting...' : 'Submit Application →'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT, lineHeight: 1.6 }}>
            We review every application personally. You'll hear from Yuvaraj Premlal within 1–2 weeks.<br />
            Your email and LinkedIn are for verification only — never shown to other members.
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT }}>
          Already a member?{' '}
          <span onClick={() => navigate('/community/login')} style={{ color: NAVY, cursor: 'pointer', textDecoration: 'underline' }}>
            Sign in
          </span>
        </div>
      </div>
    </div>
  )
}