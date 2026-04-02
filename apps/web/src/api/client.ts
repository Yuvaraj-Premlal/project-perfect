import axios from 'axios'

const API_BASE = 'https://project-perfect-api-hshgg9fkhvdhe2bz.centralindia-01.azurewebsites.net'

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/onboard')) {
      localStorage.removeItem('pp_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
