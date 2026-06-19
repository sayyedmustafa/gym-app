import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { formatINR } from '@/lib/utils'
import { Receipt, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EditPaymentDialog } from '@/components/EditPaymentDialog'
import { toast } from 'sonner'
import type { Payment, MemberWithStatus } from '@/types/database'

interface Props {
  member: MemberWithStatus
}

export function PaymentHistoryList({ member }: Props) {
  const currentGymId = useAuthStore((s) => s.currentGymId)
  const queryClient = useQueryClient()
  const [editPayment, setEditPayment] = useState<Payment | null>(null)
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['payments', member.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('member_id', member.id)
        .order('paid_on', { ascending: false })
      if (error) throw error
      return (data ?? []) as Payment[]
    },
    enabled: !!member.id,
  })

  async function handleConfirmDelete() {
    if (!deletePayment) return
    setDeleting(true)

    const { error: delErr } = await supabase
      .from('payments')
      .delete()
      .eq('id', deletePayment.id)

    if (delErr) {
      setDeleting(false)
      toast.error('Failed to delete payment', { description: delErr.message })
      return
    }

    // Adjust member totals only if the deleted payment is in the current cycle
    const isCurrentCycle = deletePayment.paid_on >= member.start_date
    if (isCurrentCycle) {
      const newPaid = Math.max(0, (member.paid_amount ?? 0) - deletePayment.amount)
      const newBalance = (member.balance_amount ?? 0) + deletePayment.amount
      const { error: memErr } = await supabase
        .from('members')
        .update({ paid_amount: newPaid, balance_amount: newBalance })
        .eq('id', member.id)
      if (memErr) {
        setDeleting(false)
        toast.error('Payment deleted but member totals failed', { description: memErr.message })
        return
      }
    }

    setDeleting(false)
    toast.success('Payment deleted')
    queryClient.invalidateQueries({ queryKey: ['payments', member.id] })
    queryClient.invalidateQueries({ queryKey: ['members', currentGymId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats', currentGymId] })
    setDeletePayment(null)
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payments...</p>
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-6 text-center">
        <Receipt className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No payments recorded yet</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {payments.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{formatINR(p.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(p.paid_on), 'dd MMM yyyy')} · {p.method.toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valid till</p>
              <p className="text-xs font-medium">
                {format(new Date(p.extends_to || p.paid_on), 'dd MMM yyyy')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Edit payment"
                onClick={() => setEditPayment(p)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Delete payment"
                onClick={() => setDeletePayment(p)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editPayment && (
        <EditPaymentDialog
          open={!!editPayment}
          onClose={() => setEditPayment(null)}
          payment={editPayment}
          member={member}
        />
      )}

      <Dialog open={!!deletePayment} onClose={() => !deleting && setDeletePayment(null)}>
        <DialogHeader>
          <DialogTitle>Delete Payment?</DialogTitle>
          <DialogDescription>
            {deletePayment && (
              <>
                {formatINR(deletePayment.amount)} on{' '}
                {format(new Date(deletePayment.paid_on), 'dd MMM yyyy')} will be permanently removed.
                {deletePayment.paid_on >= member.start_date
                  ? ' Member balance will be restored by this amount.'
                  : ' This payment is from a previous cycle; member totals will not change.'}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setDeletePayment(null)}
            disabled={deleting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="flex-1"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}

