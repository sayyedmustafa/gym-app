import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

// Set to false once Supabase is connected
const DEV_BYPASS = false

export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)

  if (DEV_BYPASS) return <Outlet />
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireGym() {
  const gyms = useAuthStore((s) => s.gyms)
  const initialized = useAuthStore((s) => s.initialized)

  if (DEV_BYPASS) return <Outlet />
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  if (gyms.length === 0) return <Navigate to="/onboarding" replace />
  return <Outlet />
}