import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireGym() {
  const gyms = useAuthStore((s) => s.gyms)
  if (gyms.length === 0) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
