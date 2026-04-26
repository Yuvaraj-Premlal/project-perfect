import axios from 'axios'

const API_BASE = 'https://project-perfect-api-hshgg9fkhvdhe2bz.centralindia-01.azurewebsites.net'

export const communityApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})

// Attach community token to every request
communityApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_community_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to community login on 401
communityApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !window.location.pathname.includes('/community/login')
    ) {
      localStorage.removeItem('pp_community_token')
      localStorage.removeItem('pp_community_member')
      window.location.href = '/community/login'
    }
    return Promise.reject(err)
  }
)

// ── AUTH ─────────────────────────────────────────────────────
export const communityAuth = {
  login: (email: string, password: string) =>
    communityApi.post('/community/auth/login', { email, password }),

  setupPassword: (token: string, password: string) =>
    communityApi.post('/community/auth/setup-password', { token, password }),

  logout: () =>
    communityApi.post('/community/auth/logout'),
}

// ── APPLICATIONS ─────────────────────────────────────────────
export const communityApplications = {
  apply: (data: {
    name: string
    email: string
    role: string
    company_name: string
    company_sector: string
    country: string
    linkedin_url: string
    qualifying_answer: string
  }) => communityApi.post('/community/apply', data),

  getAll: (status = 'pending') =>
    communityApi.get(`/community/?status=${status}`),

  update: (id: string, data: { status: string; admin_note?: string }) =>
    communityApi.patch(`/community/${id}`, data),
}

// ── POSTS ────────────────────────────────────────────────────
export const communityPosts = {
  getFeed: (type?: string, limit = 20, offset = 0) =>
    communityApi.get('/community/posts', { params: { type, limit, offset } }),

  create: (data: { type: string; body: string; is_anonymous?: boolean }) =>
    communityApi.post('/community/posts', data),

  edit: (id: string, body: string) =>
    communityApi.patch(`/community/posts/${id}`, { body }),

  save: (id: string) =>
    communityApi.post(`/community/posts/${id}/save`),

  unsave: (id: string) =>
    communityApi.delete(`/community/posts/${id}/save`),

  flag: (id: string, reason?: string) =>
    communityApi.post(`/community/posts/${id}/flag`, { reason }),

  getComments: (id: string) =>
    communityApi.get(`/community/posts/${id}/comments`),

  addComment: (id: string, body: string) =>
    communityApi.post(`/community/posts/${id}/comments`, { body }),

  resolve: (id: string) =>
    communityApi.patch(`/community/posts/${id}/resolve`),
}

// ── PLAYBOOK ─────────────────────────────────────────────────
export const communityPlaybook = {
  getAll: (category?: string, search?: string) =>
    communityApi.get('/community/playbook', { params: { category, search } }),

  add: (data: {
    post_id: string
    category: string
    curator_note: string
    subcategory?: string
    featured_order?: number
  }) => communityApi.post('/community/playbook', data),

  remove: (id: string) =>
    communityApi.delete(`/community/playbook/${id}`),
}

// ── CRISIS ───────────────────────────────────────────────────
export const communityCrisis = {
  getActive: () => communityApi.get('/community/crisis?resolved=false'),
  getResolved: () => communityApi.get('/community/crisis?resolved=true'),
}

// ── EVENTS ───────────────────────────────────────────────────
export const communityEvents = {
  getAll: () => communityApi.get('/community/events'),

  rsvp: (id: string, question?: string) =>
    communityApi.post(`/community/events/${id}/rsvp`, { question }),

  cancelRsvp: (id: string) =>
    communityApi.delete(`/community/events/${id}/rsvp`),
}

// ── ADMIN ────────────────────────────────────────────────────
export const communityAdmin = {
  getDashboard: () =>
    communityApi.get('/community/admin/dashboard'),

  getTasks: (status = 'pending') =>
    communityApi.get(`/community/admin/tasks?status=${status}`),

  updateTask: (id: string, data: { status: string; snooze_hours?: number }) =>
    communityApi.patch(`/community/admin/tasks/${id}`, data),

  getMembers: (status = 'active') =>
    communityApi.get(`/community/admin/members?status=${status}`),

  updateMember: (id: string, data: { status?: string; tier?: string }) =>
    communityApi.patch(`/community/admin/members/${id}`, data),

  generateInvite: (id: string) =>
    communityApi.post(`/community/admin/members/${id}/invite`),

  exportMembers: () =>
    communityApi.get('/community/admin/export/members', { responseType: 'blob' }),
}

// ── HELPERS ──────────────────────────────────────────────────
export function getCommunityMember() {
  const raw = localStorage.getItem('pp_community_member')
  return raw ? JSON.parse(raw) : null
}

export function setCommunitySession(token: string, member: object) {
  localStorage.setItem('pp_community_token', token)
  localStorage.setItem('pp_community_member', JSON.stringify(member))
}

export function clearCommunitySession() {
  localStorage.removeItem('pp_community_token')
  localStorage.removeItem('pp_community_member')
}