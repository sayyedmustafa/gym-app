import { Users, UserMinus, AlertTriangle, IndianRupee, Wallet, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

      const [activeRes, expiringRes, expiredRes, revenueRes, duesRes] = await Promise.all([
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

        // Outstanding dues across all members
        supabase
          .from('members')
          .select('balance_amount')
          .eq('gym_id', gymId)
          .gt('balance_amount', 0),
      ])

      const revenue = (revenueRes.data ?? []).reduce(
        (sum, p) => sum + (p.amount ?? 0),
        0
      )

      const outstandingDues = (duesRes.data ?? []).reduce(
        (sum, m) => sum + (m.balance_amount ?? 0),
        0
      )

      return {
        active: activeRes.count ?? 0,
        expiring: expiringRes.count ?? 0,
        expired: expiredRes.count ?? 0,
        revenue,
        outstandingDues,
      }
    },
    enabled: !!gymId,
  })
}

export function DashboardPage() {
  const isOwner = useAuthStore((s) => s.isOwner)
  const gymId = useAuthStore((s) => s.currentGymId)
  const navigate = useNavigate()

  const { data: stats, isLoading } = useDashboardStats(gymId ?? '')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground md:text-base">Overview of your gym</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
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
        <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground md:text-base">Overview of your gym</p>
      </div>

      {/* Expiry banner */}
      {((stats?.expiring ?? 0) > 0 || (stats?.expired ?? 0) > 0) && (
        <div
          className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
            (stats?.expired ?? 0) > 0
              ? 'border-destructive/30 bg-destructive/10'
              : 'border-warning/30 bg-warning/10'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                (stats?.expired ?? 0) > 0 ? 'text-destructive' : 'text-warning'
              }`}
            />
            <div>
              <p className="font-semibold">
                {(stats?.expiring ?? 0) > 0 && `${stats?.expiring} expiring this week`}
                {(stats?.expiring ?? 0) > 0 && (stats?.expired ?? 0) > 0 && ', '}
                {(stats?.expired ?? 0) > 0 && `${stats?.expired} already expired`}
              </p>
              <p className="text-xs text-muted-foreground">Send WhatsApp reminders to encourage renewals.</p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1 self-start sm:self-auto"
            onClick={() =>
              navigate(
                `/app/members?status=${(stats?.expired ?? 0) > 0 ? 'expired' : 'expiring_soon'}`
              )
            }
          >
            Send Reminders <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold md:text-2xl">{stats?.active ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-warning md:text-2xl">{stats?.expiring ?? 0}</div>
            <p className="text-xs text-muted-foreground">Within 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium md:text-sm">Expired</CardTitle>
            <UserMinus className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive md:text-2xl">{stats?.expired ?? 0}</div>
          </CardContent>
        </Card>

        {isOwner() && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium md:text-sm">Revenue (This Month)</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold md:text-2xl">{formatINR(stats?.revenue ?? 0)}</div>
            </CardContent>
          </Card>
        )}

        {isOwner() && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium md:text-sm">Outstanding Dues</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold md:text-2xl">{formatINR(stats?.outstandingDues ?? 0)}</div>
              <p className="text-xs text-muted-foreground">Pending member balances</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}