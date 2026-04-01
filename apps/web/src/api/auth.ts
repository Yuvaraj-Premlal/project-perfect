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
      name:     payload.name || '',
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

export function canEditProject(pmUserId: string): boolean {
  const user = getCurrentUser()
  if (!user) return false
  // Super User and Portfolio Manager can edit all projects
  if (user.role === 'super_user' || user.role === 'portfolio_manager') return true
  // PM can only edit their own projects
  if (user.role === 'pm') return user.userId === pmUserId
  // Visitor cannot edit anything
  return false
}
