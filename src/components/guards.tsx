import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

// Set to false once Supabase is connected
const DEV_BYPASS = false

export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  if (DEV_BYPASS) return <Outlet />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireGym() {
  const gyms = useAuthStore((s) => s.gyms)
  if (DEV_BYPASS) return <Outlet />
  if (gyms.length === 0) return <Navigate to="/onboarding" replace />
  return <Outlet />
}