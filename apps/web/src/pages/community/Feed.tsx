import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityPosts, getCommunityMember } from '../../api/community'

const NAVY = '#163B6D'
const NAVY_LIGHT = '#EBF1FB'
const BORDER = '#E2E8F0'
const TEXT = '#0F172A'
const TEXT_MID = '#334155'
const TEXT_LIGHT = '#64748B'
const TEXT_FAINT = '#94A3B8'
const GREEN = '#059669'
const GREEN_BG = '#ECFDF5'
const AMBER = '#D97706'
const AMBER_BG = '#FFFBEB'
const RED = '#DC2626'
const RED_BG = '#FEF2F2'

const POST_TYPES = ['question', 'article', 'win', 'tool', 'crisis'] as const
type PostType = typeof POST_TYPES[number]

const WORD_LIMITS: Record<string, { min: number; max: number }> = {
  question: { min: 0,   max: 100 },
  article:  { min: 150, max: 600 },
  win:      { min: 100, max: 300 },
  crisis:   { min: 50,  max: 400 },
}

const TYPE_LABELS: Record<string, string> = {
  question: '? Question',
  article:  '▤ Article',
  win:      '✦ Delivery Win',
  tool:     '⚙ Tool',
  crisis:   '◉ Crisis',
}

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  question: { bg: NAVY_LIGHT,  color: NAVY,   border: 'rgba(22,59,109,0.2)' },
  article:  { bg: '#F1F5F9',   color: TEXT_LIGHT, border: BORDER },
  win:      { bg: GREEN_BG,    color: GREEN,  border: '#A7F3D0' },
  tool:     { bg: AMBER_BG,    color: AMBER,  border: '#FCD34D' },
  crisis:   { bg: RED_BG,      color: RED,    border: '#FECACA' },
}

const TIER_LABELS: Record<string, string> = {
  contributor:  'Contributor',
  practitioner: 'Practitioner',
  veteran:      '★ Veteran',
}

interface Post {
  id: string
  type: PostType
  body: string
  is_pinned: boolean
  is_anonymous: boolean
  is_resolved: boolean
  expires_at: string | null
  created_at: string
  member_id: string | null
  author_name: string
  author_role: string
  author_country: string
  author_tier: string
  comment_count: number
  save_count: number
}

interface Comment {
  id: string
  body: string
  author_name: string
  author_role: string
  author_tier: string
  created_at: string
}

export default function CommunityFeed() {
  const navigate = useNavigate()
  const member = getCommunityMember()

  const [posts, setPosts]           = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<string>('all')
  const [postType, setPostType]     = useState<PostType>('question')
  const [postBody, setPostBody]     = useState('')
  const [posting, setPosting]       = useState(false)
  const [openComments, setOpenComments] = useState<Record<string, Comment[]>>({})
  const [commentText, setCommentText]   = useState<Record<string, string>>({})
  const [savedPosts, setSavedPosts]     = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState('')

  useEffect(() => {
    if (!member) { navigate('/community/login'); return }
    loadPosts()
  }, [filter])

  async function loadPosts() {
    setLoading(true)
    try {
      const res = await communityPosts.getFeed(filter === 'all' ? undefined : filter)
      setPosts(res.data)
    } catch {
      showToast('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  function wordCount(text: string) {
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }

  async function handlePost() {
    if (!postBody.trim()) { showToast('Write something first'); return }
    const wc = wordCount(postBody)
    const limits = WORD_LIMITS[postType]
    if (limits) {
      if (limits.min > 0 && wc < limits.min) { showToast(`Minimum ${limits.min} words required`); return }
      if (wc > limits.max) { showToast(`Maximum ${limits.max} words allowed`); return }
    }
    setPosting(true)
    try {
      await communityPosts.create({ type: postType, body: postBody, is_anonymous: postType === 'crisis' })
      setPostBody('')
      showToast('Post published')
      loadPosts()
    } catch {
      showToast('Failed to post')
    } finally {
      setPosting(false)
    }
  }

  async function handleSave(postId: string) {
    try {
      if (savedPosts.has(postId)) {
        await communityPosts.unsave(postId)
        setSavedPosts(prev => { const s = new Set(prev); s.delete(postId); return s })
        showToast('Removed from Playbook')
      } else {
        await communityPosts.save(postId)
        setSavedPosts(prev => new Set(prev).add(postId))
        showToast('◈ Saved to Playbook')
      }
    } catch { showToast('Failed to save') }
  }

  async function loadComments(postId: string) {
    if (openComments[postId]) {
      setOpenComments(prev => { const n = { ...prev }; delete n[postId]; return n })
      return
    }
    try {
      const res = await communityPosts.getComments(postId)
      setOpenComments(prev => ({ ...prev, [postId]: res.data }))
    } catch { showToast('Failed to load comments') }
  }

  async function handleComment(postId: string) {
    const body = commentText[postId]
    if (!body?.trim()) return
    try {
      await communityPosts.addComment(postId, body)
      setCommentText(prev => ({ ...prev, [postId]: '' }))
      const res = await communityPosts.getComments(postId)
      setOpenComments(prev => ({ ...prev, [postId]: res.data }))
      showToast('Comment posted')
    } catch { showToast('Failed to post comment') }
  }

  async function handleResolve(postId: string) {
    try {
      await communityPosts.resolve(postId)
      showToast('Crisis marked as resolved')
      loadPosts()
    } catch { showToast('Failed to resolve') }
  }

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.type === filter)
  const wc = wordCount(postBody)
  const limits = WORD_LIMITS[postType]
  const wcColor = limits && wc > limits.max ? RED : TEXT_FAINT

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* TOPBAR */}
      <div style={{
        background: NAVY, height: 54, display: 'flex', alignItems: 'center',
        padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(14,40,71,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
             onClick={() => navigate('/community')}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>PP</div>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '.08em' }}>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>Project Perfect</span> Community
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {[
            { label: 'Feed',     path: '/community' },
            { label: 'Crisis',   path: '/community/crisis' },
            { label: 'Playbook', path: '/community/playbook' },
            { label: 'Events',   path: '/community/events' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)',
              fontSize: 12, fontFamily: 'monospace', letterSpacing: '.05em',
              padding: '6px 11px', borderRadius: 6, cursor: 'pointer'
            }}>{item.label}</button>
          ))}
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          color: '#fff', fontFamily: 'monospace', fontSize: 10, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: '1px solid rgba(255,255,255,0.25)', marginLeft: 12
        }} onClick={() => navigate('/community/profile')}>
          {member?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* COMPOSE */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '1.1rem', marginBottom: '.85rem', boxShadow: '0 1px 3px rgba(22,59,109,0.08)' }}>
          <textarea
            value={postBody}
            onChange={e => setPostBody(e.target.value)}
            placeholder="Share an insight, a delivery win, or a useful method with the community..."
            style={{
              width: '100%', minHeight: 80, background: '#F8FAFC',
              border: `1px solid ${BORDER}`, borderRadius: 6, padding: '.75rem .9rem',
              color: TEXT, fontSize: 13, fontFamily: 'inherit', resize: 'none',
              outline: 'none', lineHeight: 1.6, marginBottom: '.75rem'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap' }}>
            {(Object.keys(TYPE_LABELS) as PostType[]).map(t => (
              <button key={t} onClick={() => setPostType(t)} style={{
                background: postType === t ? NAVY_LIGHT : '#F1F5F9',
                border: `1px solid ${postType === t ? NAVY : BORDER}`,
                color: postType === t ? NAVY : TEXT_LIGHT,
                fontFamily: 'monospace', fontSize: 9, letterSpacing: '.06em',
                padding: '5px 10px', borderRadius: 20, cursor: 'pointer'
              }}>{TYPE_LABELS[t]}</button>
            ))}
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: wcColor, marginLeft: 'auto', marginRight: 8 }}>
              {wc} words{limits ? ` / ${limits.max}` : ''}
            </span>
            <button onClick={handlePost} disabled={posting} style={{
              background: NAVY, border: 'none', color: '#fff',
              fontFamily: 'monospace', fontSize: 10, letterSpacing: '.08em',
              padding: '8px 18px', borderRadius: 6, cursor: 'pointer', opacity: posting ? .7 : 1
            }}>{posting ? 'Posting...' : 'Post →'}</button>
          </div>
        </div>

        {/* FILTER TABS */}
        <div style={{ display: 'flex', borderBottom: `2px solid ${BORDER}`, marginBottom: '.85rem' }}>
          {[
            { key: 'all',      label: 'All' },
            { key: 'question', label: 'Questions' },
            { key: 'win',      label: 'Delivery Wins' },
            { key: 'article',  label: 'Articles' },
            { key: 'tool',     label: 'Tools' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
              background: 'none', border: 'none',
              borderBottom: `2px solid ${filter === tab.key ? NAVY : 'transparent'}`,
              color: filter === tab.key ? NAVY : TEXT_FAINT,
              fontFamily: 'monospace', fontSize: 10, letterSpacing: '.06em',
              padding: '.55rem .9rem', cursor: 'pointer', marginBottom: -2,
              fontWeight: filter === tab.key ? 500 : 400
            }}>{tab.label}</button>
          ))}
        </div>

        {/* POSTS */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: TEXT_FAINT, fontFamily: 'monospace', fontSize: 12 }}>
            Loading...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: TEXT_FAINT, fontFamily: 'monospace', fontSize: 12 }}>
            No posts yet. Be the first to share something.
          </div>
        ) : filteredPosts.map(post => {
          const tc = TYPE_COLORS[post.type] || TYPE_COLORS.article
          const isSaved = savedPosts.has(post.id)
          const comments = openComments[post.id]

          return (
            <div key={post.id} style={{
              background: '#fff', border: `1px solid ${post.type === 'crisis' ? '#FECACA' : BORDER}`,
              borderLeft: post.type === 'crisis' ? `3px solid ${RED}` : `1px solid ${BORDER}`,
              borderRadius: 10, padding: '1.1rem', marginBottom: '.7rem',
              boxShadow: '0 1px 3px rgba(22,59,109,0.06)'
            }}>
              {/* POST HEADER */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', marginBottom: '.8rem' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: post.is_anonymous ? '#F1F5F9' : NAVY,
                  color: post.is_anonymous ? TEXT_FAINT : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace', fontSize: post.is_anonymous ? 18 : 11, fontWeight: 500,
                  border: post.is_anonymous ? `1px solid ${BORDER}` : 'none'
                }}>
                  {post.is_anonymous ? '?' : post.author_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontFamily: 'serif', fontSize: 14, fontWeight: 500, color: TEXT }}>
                      {post.is_anonymous ? 'Anonymous Member' : post.author_name}
                    </span>
                    {post.author_tier && !post.is_anonymous && (
                      <span style={{
                        fontFamily: 'monospace', fontSize: 8, color: NAVY,
                        background: NAVY_LIGHT, padding: '1px 7px', borderRadius: 20,
                        border: `1px solid ${NAVY_LIGHT}`
                      }}>{TIER_LABELS[post.author_tier]}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_FAINT, letterSpacing: '.04em' }}>
                    {post.author_role} · {post.author_country}
                    {post.is_anonymous && ' · Role shown, identity hidden'}
                  </div>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: TEXT_FAINT, flexShrink: 0 }}>
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* POST TYPE TAG */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color,
                fontFamily: 'monospace', fontSize: 8, letterSpacing: '.08em',
                padding: '2px 9px', borderRadius: 20, marginBottom: '.6rem', fontWeight: 500
              }}>
                {post.is_pinned ? '★ Weekly Question · Pinned' : TYPE_LABELS[post.type]}
              </div>

              {/* POST BODY */}
              <div style={{ fontSize: 13.5, fontWeight: 300, color: TEXT_MID, lineHeight: 1.8, marginBottom: '.85rem' }}>
                {post.body}
              </div>

              {/* CRISIS EXPIRY */}
              {post.type === 'crisis' && post.expires_at && (
                <div style={{
                  fontFamily: 'monospace', fontSize: 9, color: RED,
                  background: RED_BG, padding: '3px 9px', borderRadius: 20,
                  display: 'inline-block', marginBottom: '.75rem',
                  border: `1px solid #FECACA`
                }}>
                  Expires {new Date(post.expires_at).toLocaleDateString()}
                </div>
              )}

              {/* POST FOOTER */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderTop: `1px solid ${BORDER}`, paddingTop: '.75rem' }}>
                <button onClick={() => handleSave(post.id)} style={{
                  background: isSaved ? NAVY_LIGHT : 'none',
                  color: isSaved ? NAVY : TEXT_FAINT,
                  border: 'none', fontFamily: 'monospace', fontSize: 10,
                  padding: '5px 9px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                }}>◈ {isSaved ? 'Saved' : 'Save to Playbook'}</button>

                <button onClick={() => loadComments(post.id)} style={{
                  background: 'none', color: TEXT_FAINT, border: 'none',
                  fontFamily: 'monospace', fontSize: 10,
                  padding: '5px 9px', borderRadius: 6, cursor: 'pointer'
                }}>◎ {post.comment_count} {post.type === 'crisis' ? 'responses' : 'replies'}</button>

                {post.type === 'crisis' && !post.is_resolved && post.member_id === member?.id && (
                  <button onClick={() => handleResolve(post.id)} style={{
                    background: GREEN_BG, color: GREEN, border: `1px solid #A7F3D0`,
                    fontFamily: 'monospace', fontSize: 10,
                    padding: '5px 9px', borderRadius: 6, cursor: 'pointer', marginLeft: 'auto'
                  }}>✓ Mark Resolved</button>
                )}

                {post.is_resolved && (
                  <span style={{
                    marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9,
                    color: GREEN, background: GREEN_BG, padding: '3px 9px', borderRadius: 20
                  }}>✓ Resolved</span>
                )}
              </div>

              {/* COMMENTS */}
              {comments && (
                <div style={{ marginTop: '.85rem', borderTop: `1px solid ${BORDER}`, paddingTop: '.85rem' }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: '.55rem', marginBottom: '.65rem' }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', background: NAVY,
                        color: '#fff', fontFamily: 'monospace', fontSize: 9, fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {c.author_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{
                        background: '#F8FAFC', border: `1px solid ${BORDER}`,
                        borderRadius: '0 6px 6px 6px', padding: '.55rem .8rem', flex: 1
                      }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: NAVY, marginBottom: 2, fontWeight: 500 }}>
                          {c.author_name} · {TIER_LABELS[c.author_tier]}
                        </div>
                        <div style={{ fontSize: 12.5, color: TEXT_MID, lineHeight: 1.6 }}>{c.body}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
                    <input
                      value={commentText[post.id] || ''}
                      onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                      placeholder="Add a reply..."
                      style={{
                        flex: 1, background: '#fff', border: `1px solid ${BORDER}`,
                        color: TEXT, fontSize: 12, padding: '7px 10px',
                        borderRadius: 6, outline: 'none', fontFamily: 'inherit'
                      }}
                    />
                    <button onClick={() => handleComment(post.id)} style={{
                      background: NAVY, border: 'none', color: '#fff',
                      fontFamily: 'monospace', fontSize: 10, padding: '7px 12px',
                      borderRadius: 6, cursor: 'pointer'
                    }}>→</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* FOOTER */}
      <div style={{
        maxWidth: 780, margin: '2rem auto 1rem', padding: '1rem',
        borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '.5rem'
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT }}>
          <strong style={{ color: NAVY }}>Project Perfect Community</strong> · For manufacturing ops leaders who are done managing projects on hope.
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: TEXT_FAINT }}>projectperfect.in/community</span>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: NAVY, color: '#fff', fontFamily: 'monospace', fontSize: 11,
          padding: '.65rem 1.25rem', borderRadius: 6, zIndex: 999,
          boxShadow: '0 4px 16px rgba(22,59,109,0.3)'
        }}>{toast}</div>
      )}
    </div>
  )
}