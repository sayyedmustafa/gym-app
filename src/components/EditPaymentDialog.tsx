import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import type { Payment, MemberWithStatus } from '@/types/database'

const schema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  method: z.enum(['cash', 'card', 'upi', 'other']),
  paid_on: z.string().min(1, 'Select a date'),
})

type FormData = z.infer<typeof schema>
type FormInput = z.input<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  payment: Payment
  member: MemberWithStatus
  onSuccess?: () => void
}

export function EditPaymentDialog({ open, onClose, payment, member, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const currentGymId = useAuthStore((s) => s.currentGymId)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: payment.amount,
      method: payment.method,
      paid_on: payment.paid_on,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        amount: payment.amount,
        method: payment.method,
        paid_on: payment.paid_on,
      })
    }
  }, [open, payment.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const isCurrentCycle = payment.paid_on >= member.start_date

  async function onSubmit(data: FormData) {
    setLoading(true)

    const { error: payErr } = await supabase
      .from('payments')
      .update({
        amount: data.amount,
        method: data.method,
        paid_on: data.paid_on,
      })
      .eq('id', payment.id)

    if (payErr) {
      setLoading(false)
      toast.error('Failed to update payment', { description: payErr.message })
      return
    }

    // If this payment belongs to the current cycle, adjust member totals by the delta
    if (isCurrentCycle) {
      const delta = data.amount - payment.amount
      const newPaid = Math.max(0, (member.paid_amount ?? 0) + delta)
      const newBalance = Math.max(0, (member.balance_amount ?? 0) - delta)
      const { error: memErr } = await supabase
        .from('members')
        .update({ paid_amount: newPaid, balance_amount: newBalance })
        .eq('id', member.id)
      if (memErr) {
        setLoading(false)
        toast.error('Payment updated but member totals failed', { description: memErr.message })
        return
      }
    }

    setLoading(false)
    toast.success('Payment updated')
    queryClient.invalidateQueries({ queryKey: ['payments', member.id] })
    queryClient.invalidateQueries({ queryKey: ['members', currentGymId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats', currentGymId] })
    onSuccess?.()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Edit Payment</DialogTitle>
        <DialogDescription>
          {isCurrentCycle
            ? 'Member totals will be adjusted automatically.'
            : 'This payment is from a previous cycle. Only the record will be changed.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Amount (₹)</Label>
          <Input type="number" step="1" {...register('amount')} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Method</Label>
            <Select {...register('method')}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Paid On</Label>
            <Input type="date" {...register('paid_on')} />
            {errors.paid_on && <p className="text-xs text-destructive">{errors.paid_on.message}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
