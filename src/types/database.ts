// Database row types — these mirror what the backend dev will deliver via
// `supabase gen types typescript`. They are hand-written for now so the
// frontend can be built without waiting on the schema.

export type GymRole = 'owner' | 'staff'
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'other'
export type MemberStatus = 'active' | 'expiring_soon' | 'expired' | 'frozen'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Gym {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  logo_url?: string | null
  created_by?: string | null
  created_at: string
}

export interface GymMember {
  gym_id: string
  user_id: string
  role: GymRole
  joined_at: string
  // Joined data (populated via select with relation)
  profile?: Profile
}

export interface Invite {
  id: string
  gym_id: string
  code: string
  role: GymRole
  expires_at: string
  created_by: string
  used_by: string | null
  used_at: string | null
  created_at: string
}

export interface Plan {
  id: string
  gym_id: string
  name: string
  price: number
  duration_days: number
  description: string | null
  allows_freeze: boolean
  max_freeze_days: number
  is_active: boolean
  created_at: string
}

export interface Member {
  id: string
  gym_id: string
  name: string
  phone: string
  photo_url: string | null
  plan_id: string | null
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  notes: string | null
  created_by: string
  created_at: string
  discount_amount?: number
  paid_amount?: number
  balance_amount?: number
}

export interface MemberWithStatus extends Member {
  status: MemberStatus
  plan?: Plan | null
}

export interface Payment {
  id: string
  gym_id: string
  member_id: string
  plan_id: string
  amount: number
  method: PaymentMethod
  paid_on: string // YYYY-MM-DD
  extends_to: string // YYYY-MM-DD
  created_by: string
  created_at: string
}

export interface Freeze {
  id: string
  gym_id: string
  member_id: string
  start_date: string
  end_date: string | null
  reason: string | null
  created_by: string
  created_at: string
}

export interface Session {
  user: {
    id: string
    email: string
    user_metadata: {
      full_name?: string
      avatar_url?: string
    }
  }
}
