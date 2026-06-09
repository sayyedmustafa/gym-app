import { Users, UserMinus, AlertTriangle, IndianRupee } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth'
import { formatINR } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function useDashboardStats(gymId: string) {
  return useQuery({
    queryKey: ['dashboard-stats', gymId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      // First day of current month
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1)
      const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0]

      const [activeRes, expiringRes, expiredRes, revenueRes] = await Promise.all([
        // Active: end_date >= today
        supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('end_date', today),

        // Expiring soon: end_date between today and today+7
        supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .gte('end_date', today)
          .lte('end_date', in7Days),

        // Expired: end_date < today
        supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .lt('end_date', today),

        // Revenue this month
        supabase
          .from('payments')
          .select('amount')
          .eq('gym_id', gymId)
          .gte('paid_on', firstOfMonthStr),
      ])

      const revenue = (revenueRes.data ?? []).reduce(
        (sum, p) => sum + (p.amount ?? 0),
        0
      )

      return {
        active: activeRes.count ?? 0,
        expiring: expiringRes.count ?? 0,
        expired: expiredRes.count ?? 0,
        revenue,
      }
    },
    enabled: !!gymId,
  })
}

export function DashboardPage() {
  const isOwner = useAuthStore((s) => s.isOwner)
  const gymId = useAuthStore((s) => s.gyms?.[0]?.id)

  const { data: stats, isLoading } = useDashboardStats(gymId ?? '')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your gym</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your gym</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats?.expiring ?? 0}</div>
            <p className="text-xs text-muted-foreground">Within 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <UserMinus className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.expired ?? 0}</div>
          </CardContent>
        </Card>

        {isOwner() && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue (This Month)</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(stats?.revenue ?? 0)}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}