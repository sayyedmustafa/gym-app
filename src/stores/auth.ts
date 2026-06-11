import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Gym, GymRole, Session } from '@/types/database'

interface GymWithRole extends Gym {
  role: GymRole
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  gyms: GymWithRole[]
  currentGymId: string | null
  initialized: boolean

  // Derived
  currentGym: () => GymWithRole | null
  currentRole: () => GymRole | null
  isOwner: () => boolean

  // Actions
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setGyms: (gyms: GymWithRole[]) => void
  setCurrentGymId: (id: string) => void
  setInitialized: (initialized: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      gyms: [],
      currentGymId: null,
      initialized: false,

      currentGym: () => {
        const { gyms, currentGymId } = get()
        return gyms.find((g) => g.id === currentGymId) ?? null
      },

      currentRole: () => {
        const { gyms, currentGymId } = get()
        const gym = gyms.find((g) => g.id === currentGymId)
        return gym?.role ?? null
      },

      isOwner: () => get().currentRole() === 'owner',

      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setGyms: (gyms) => {
        const { currentGymId } = get()
        // If current gym is no longer in the list, reset to the first one
        const valid = gyms.find((g) => g.id === currentGymId)
        set({
          gyms,
          currentGymId: valid ? currentGymId : gyms[0]?.id ?? null,
        })
      },
      setCurrentGymId: (id) => set({ currentGymId: id }),
      setInitialized: (initialized) => set({ initialized }),
      reset: () =>
        set({
          session: null,
          profile: null,
          gyms: [],
          currentGymId: null,
          initialized: false,
        }),
    }),
    {
      name: 'gym-app-auth',
      partialize: (state) => ({
        currentGymId: state.currentGymId,
      }),
    }
  )
)
