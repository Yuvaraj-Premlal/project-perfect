import { api } from './client'
export const getProjects          = () => api.get('/api/projects').then(r => r.data)
export const getProject           = (id: string) => api.get(`/api/projects/${id}`).then(r => r.data)
export const createProject        = (data: any) => api.post('/api/projects', data).then(r => r.data)
export const createPhase          = (pid: string, data: any) => api.post(`/api/projects/${pid}/phases`, data).then(r => r.data)
export const getTasks             = (pid: string) => api.get(`/api/projects/${pid}/tasks`).then(r => r.data)
export const createTask           = (pid: string, data: any) => api.post(`/api/projects/${pid}/tasks`, data).then(r => r.data)
export const updateTask           = (pid: string, tid: string, data: any) => api.put(`/api/projects/${pid}/tasks/${tid}`, data).then(r => r.data)
export const getReviews           = (pid: string) => api.get(`/api/projects/${pid}/reviews`).then(r => r.data)
export const createReview         = (pid: string, data: any) => api.post(`/api/projects/${pid}/reviews`, data).then(r => r.data)
export const getWeeklyReports     = (pid: string) => api.get(`/api/projects/${pid}/weekly-reports`).then(r => r.data)
export const generateWeeklyReport = (pid: string) => api.post(`/api/projects/${pid}/weekly-reports`).then(r => r.data)
export const getPreReviewBrief    = (pid: string) => api.get(`/api/projects/${pid}/nudges/pre-review-brief`).then(r => r.data)
export const sendNudge            = (pid: string, taskId: string) => api.post(`/api/projects/${pid}/nudges/${taskId}`).then(r => r.data)
export const closeProject         = (pid: string, data: any) => api.post(`/api/projects/${pid}/closure`, data).then(r => r.data)
export const getClosureReport     = (pid: string) => api.get(`/api/projects/${pid}/closure`).then(r => r.data)

export const getLearnings          = () => api.get('/api/learnings').then(r => r.data)
export const getLearning           = (rid: string) => api.get(`/api/learnings/${rid}`).then(r => r.data)
export const toggleReaction        = (rid: string, reaction_type: string) => api.post(`/api/learnings/${rid}/reactions`, { reaction_type }).then(r => r.data)
export const getComments           = (rid: string) => api.get(`/api/learnings/${rid}/comments`).then(r => r.data)
export const addComment            = (rid: string, data: any) => api.post(`/api/learnings/${rid}/comments`, data).then(r => r.data)
export const deleteComment         = (rid: string, cid: string) => api.delete(`/api/learnings/${rid}/comments/${cid}`).then(r => r.data)

export const getTaskUpdates  = (pid: string, tid: string) => api.get(`/api/projects/${pid}/tasks/${tid}/updates`).then(r => r.data)
export const createTaskUpdate = (pid: string, tid: string, data: any) => api.post(`/api/projects/${pid}/tasks/${tid}/updates`, data).then(r => r.data)

export const getReviewAgenda   = (pid: string) => api.get(`/api/projects/${pid}/nudges/review-agenda`).then(r => r.data)
export const createReviewFull  = (pid: string, data: any) => api.post(`/api/projects/${pid}/reviews`, data).then(r => r.data)

export const getReviewSummary = (pid: string) => api.get(`/api/projects/${pid}/nudges/review-summary`).then(r => r.data)
export const getCCRs   = (pid: string) => api.get(`/api/projects/${pid}/ccr`).then(r => r.data)
export const createCCR = (pid: string, data: any) => api.post(`/api/projects/${pid}/ccr`, data).then(r => r.data)

// Admin
export const getAdminUsers        = () => api.get('/api/admin/users').then(r => r.data)
export const createAdminUser      = (data: any) => api.post('/api/admin/users', data).then(r => r.data)
export const updateAdminUser      = (id: string, data: any) => api.put(`/api/admin/users/${id}`, data).then(r => r.data)
export const deactivateAdminUser  = (id: string) => api.delete(`/api/admin/users/${id}`).then(r => r.data)

export const getAdminDepartments  = () => api.get('/api/admin/departments').then(r => r.data)
export const createDepartment     = (data: any) => api.post('/api/admin/departments', data).then(r => r.data)
export const deleteDepartment     = (id: string) => api.delete(`/api/admin/departments/${id}`).then(r => r.data)

export const getAdminSuppliers    = (type?: string) => api.get(`/api/admin/suppliers${type ? '?type='+type : ''}`).then(r => r.data)
export const createAdminSupplier  = (data: any) => api.post('/api/admin/suppliers', data).then(r => r.data)
export const updateAdminSupplier  = (id: string, data: any) => api.put(`/api/admin/suppliers/${id}`, data).then(r => r.data)
export const deleteAdminSupplier  = (id: string) => api.delete(`/api/admin/suppliers/${id}`).then(r => r.data)

export const getUsers     = () => api.get('/api/users').then(r => r.data)
export const getSuppliers = (type?: string) => api.get(`/api/suppliers${type ? '?type='+type : ''}`).then(r => r.data)
