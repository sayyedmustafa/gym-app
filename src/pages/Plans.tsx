import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Snowflake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AddPlanDialog } from '@/components/AddPlanDialog'
import { formatINR } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import type { Plan } from '@/types/database'

export function PlansPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const currentGymId = useAuthStore((s) => s.currentGymId)

  const { data: plans = [], refetch: refetchPlans } = useQuery<Plan[]>({
    queryKey: ['plans', currentGymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .eq('gym_id', currentGymId!)
        .order('created_at', { ascending: false })
      return (data ?? []) as Plan[]
    },
    enabled: !!currentGymId,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Membership Plans</h1>
          <p className="text-muted-foreground">Configure pricing and durations</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">{formatINR(plan.price)}</div>
              <p className="text-sm text-muted-foreground">{plan.duration_days} days</p>
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
              {plan.allows_freeze && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Snowflake className="h-3.5 w-3.5" />
                  Freeze up to {plan.max_freeze_days} days
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="gap-1">
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddPlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetchPlans()}
      />
    </div>
  )
}
