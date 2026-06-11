import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { router } from '@/router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function AuthInitializer() {
  const { setSession, setProfile, setGyms, setInitialized, reset } = useAuthStore()

  useEffect(() => {
    let isMounted = true

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return
      if (session) {
        setSession(session as any)
        await loadUserData(session.user.id)
      } else {
        setInitialized(true)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return
        if (session) {
          setSession(session as any)
          await loadUserData(session.user.id)
        } else {
          reset()
          setInitialized(true)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadUserData(userId: string) {
    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile) setProfile(profile)

    // Fetch gyms with role
    const { data: gymMembers } = await supabase
      .from('gym_members')
      .select('role, gyms(*)')
      .eq('user_id', userId)

    if (gymMembers) {
      const gyms = gymMembers.map((gm: any) => ({
        ...gm.gyms,
        role: gm.role,
      }))
      setGyms(gyms)
    }

    setInitialized(true)
  }

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}

export default App