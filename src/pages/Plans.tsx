import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Snowflake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AddPlanDialog } from '@/components/AddPlanDialog'
import { EditPlanDialog } from '@/components/EditPlanDialog'
import { formatINR } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Plan } from '@/types/database'

export function PlansPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [deletePlan, setDeletePlan] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState(false)
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

  async function handleConfirmDelete() {
    if (!deletePlan) return
    setDeleting(true)

    // Check if any member uses this plan
    const { count, error: countErr } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', deletePlan.id)

    if (countErr) {
      setDeleting(false)
      toast.error('Failed to check plan usage', { description: countErr.message })
      return
    }

    if ((count ?? 0) > 0) {
      // Soft-delete: mark inactive instead of removing (preserves member history)
      const { error: updErr } = await supabase
        .from('plans')
        .update({ is_active: false })
        .eq('id', deletePlan.id)
      setDeleting(false)
      if (updErr) {
        toast.error('Failed to deactivate plan', { description: updErr.message })
        return
      }
      toast.success(`Plan deactivated (${count} member${count === 1 ? '' : 's'} still using it)`)
      refetchPlans()
      setDeletePlan(null)
      return
    }

    const { data: deleted, error: delErr } = await supabase
      .from('plans')
      .delete()
      .eq('id', deletePlan.id)
      .select('id')

    setDeleting(false)

    if (delErr) {
      toast.error('Failed to delete plan', { description: delErr.message })
      return
    }

    if (!deleted || deleted.length === 0) {
      toast.error('Delete blocked', {
        description: 'You may not have permission. Check RLS policies.',
      })
      return
    }

    toast.success('Plan deleted')
    refetchPlans()
    setDeletePlan(null)
  }

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
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditPlan(plan)}>
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => setDeletePlan(plan)}
                >
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

      {editPlan && (
        <EditPlanDialog
          open={!!editPlan}
          onClose={() => setEditPlan(null)}
          plan={editPlan}
          onSuccess={() => refetchPlans()}
        />
      )}

      <Dialog open={!!deletePlan} onClose={() => !deleting && setDeletePlan(null)}>
        <DialogHeader>
          <DialogTitle>Delete Plan?</DialogTitle>
          <DialogDescription>
            {deletePlan && (
              <>
                <strong>{deletePlan.name}</strong> will be removed. If any members are still on this plan,
                it will be deactivated instead of deleted (to preserve their history).
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setDeletePlan(null)} disabled={deleting} className="flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting} className="flex-1">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
