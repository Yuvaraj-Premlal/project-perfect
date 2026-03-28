export function getCurrentUser() {
  try {
    const token = localStorage.getItem('pp_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      userId:   payload.sub || payload.oid || null,
      email:    payload.email || payload.preferred_username || '',
      role:     payload.role || 'pm',
      tenantId: payload.tenant_id || null,
    }
  } catch {
    return null
  }
}

export function hasRole(...roles: string[]): boolean {
  const user = getCurrentUser()
  if (!user) return false
  return roles.includes(user.role)
}
