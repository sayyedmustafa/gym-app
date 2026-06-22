import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { formatINR } from '@/lib/utils'
import type { MemberWithStatus, Plan } from '@/types/database'

const schema = z.object({
  is_renewal: z.boolean().optional(),
  // Top-up & renewal
  amount: z.coerce.number().nonnegative('Amount cannot be negative'),
  method: z.enum(['cash', 'card', 'upi', 'other']),
  paid_on: z.string().min(1, 'Select a date'),
  // Renewal only
  plan_id: z.string().optional(),
  discount_amount: z.coerce.number().nonnegative().optional(),
  carry_forward: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>
type FormInput = z.input<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  member: MemberWithStatus
  plans: Plan[]
  onSuccess?: () => void
}

export function RecordPaymentDialog({ open, onClose, member, plans, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const session = useAuthStore((s) => s.session)
  const currentGymId = useAuthStore((s) => s.currentGymId)
  const queryClient = useQueryClient()

  const oldPending = member.balance_amount ?? 0

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_renewal: false,
      amount: oldPending > 0 ? oldPending : undefined,
      method: 'cash',
      paid_on: format(new Date(), 'yyyy-MM-dd'),
      plan_id: member.plan_id ?? '',
      discount_amount: 0,
      carry_forward: true,
    },
  })

  // Reset whenever reopened so each new dialog session starts fresh
  useEffect(() => {
    if (open) {
      reset({
        is_renewal: false,
        amount: oldPending > 0 ? oldPending : undefined,
        method: 'cash',
        paid_on: format(new Date(), 'yyyy-MM-dd'),
        plan_id: member.plan_id ?? '',
        discount_amount: 0,
        carry_forward: true,
      })
    }
  }, [open, member.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const isRenewal = watch('is_renewal')
  const paidOn = watch('paid_on')
  const selectedPlanId = watch('plan_id')
  const discountAmount = Number(watch('discount_amount') ?? 0) || 0
  const amountNow = Number(watch('amount') ?? 0) || 0
  const carryForward = watch('carry_forward')

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null
  const planPrice = selectedPlan?.price ?? 0
  const finalPrice = Math.max(0, planPrice - discountAmount)
  const newCycleEnd =
    isRenewal && selectedPlan && paidOn
      ? format(addDays(new Date(paidOn), selectedPlan.duration_days), 'yyyy-MM-dd')
      : ''

  // Auto-fill the amount whenever the renewal scenario changes so user can just click submit
  useEffect(() => {
    if (isRenewal && selectedPlan) {
      const due = finalPrice + (carryForward ? oldPending : 0)
      setValue('amount', due)
    }
  }, [isRenewal, selectedPlanId, discountAmount, carryForward])  // eslint-disable-line react-hooks/exhaustive-deps

  const newCycleBalance = isRenewal
    ? Math.max(0, finalPrice + (carryForward ? oldPending : 0) - amountNow)
    : Math.max(0, oldPending - amountNow)

  async function onSubmit(data: FormData) {
    if (!currentGymId || !session) {
      toast.error('Missing required info')
      return
    }

    if (data.is_renewal && !data.plan_id) {
      toast.error('Select a plan for the renewal')
      return
    }
    if (data.amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setLoading(true)

    const paymentPlanId = data.is_renewal ? data.plan_id! : member.plan_id
    const extendsTo = data.is_renewal && newCycleEnd ? newCycleEnd : member.end_date

    // 1. Insert payment row (historical truth)
    const { error: payErr } = await supabase.from('payments').insert({
      gym_id: currentGymId,
      member_id: member.id,
      plan_id: paymentPlanId,
      amount: data.amount,
      method: data.method,
      paid_on: data.paid_on,
      extends_to: extendsTo,
      created_by: session.user.id,
    })

    if (payErr) {
      setLoading(false)
      toast.error('Failed to record payment', { description: payErr.message })
      return
    }

    // 2. Update member row (current cycle snapshot)
    const updates: Record<string, unknown> = {}

    if (data.is_renewal) {
      // New cycle: reset totals to this cycle's snapshot
      updates.plan_id = data.plan_id
      updates.start_date = data.paid_on
      updates.end_date = newCycleEnd
      updates.discount_amount = discountAmount
      updates.paid_amount = data.amount
      updates.balance_amount = newCycleBalance
    } else {
      // Top-up: just decrement balance, bump paid total
      updates.paid_amount = (member.paid_amount ?? 0) + data.amount
      updates.balance_amount = Math.max(0, oldPending - data.amount)
    }

    const { error: memErr } = await supabase
      .from('members')
      .update(updates)
      .eq('id', member.id)

    setLoading(false)

    if (memErr) {
      toast.error('Payment saved but member update failed', { description: memErr.message })
      return
    }

    toast.success(data.is_renewal ? 'Membership renewed' : 'Payment recorded')
    queryClient.invalidateQueries({ queryKey: ['payments', member.id] })
    queryClient.invalidateQueries({ queryKey: ['members', currentGymId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats', currentGymId] })
    reset()
    onSuccess?.()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogDescription>
          {member.name}
          {oldPending > 0 && (
            <span className="ml-2 text-warning">· Pending {formatINR(oldPending)}</span>
          )}
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={handleSubmit(onSubmit, (errs) => {
          const first = Object.values(errs)[0]
          const msg = (first && 'message' in first ? (first.message as string) : '') || 'Please fix the highlighted fields'
          toast.error(msg)
        })}
        className="space-y-4"
      >
        {/* Renewal toggle */}
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
          <input type="checkbox" id="is_renewal" {...register('is_renewal')} className="mt-1" />
          <label htmlFor="is_renewal" className="text-sm">
            <span className="font-medium">This is a renewal (start a new cycle)</span>
            <span className="block text-xs text-muted-foreground">
              Resets membership dates. Otherwise it's a top-up for the current cycle.
            </span>
          </label>
        </div>

        {/* Renewal-only: plan + discount */}
        {isRenewal && (
          <>
            <div className="space-y-2">
              <Label>Plan for new cycle</Label>
              <Select {...register('plan_id')}>
                <option value="">Select a plan</option>
                {plans.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.price} / {p.duration_days} days
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discount (₹)</Label>
              <Input type="number" step="1" min="0" {...register('discount_amount')} />
            </div>
            {oldPending > 0 && (
              <div className="space-y-2 rounded-md border border-warning/30 bg-warning/5 p-3">
                <p className="text-sm font-medium">Old pending: {formatINR(oldPending)}</p>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="true"
                      {...register('carry_forward', { setValueAs: (v) => v === 'true' || v === true })}
                      defaultChecked
                    />
                    Carry forward to new cycle
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      value="false"
                      {...register('carry_forward', { setValueAs: (v) => v === 'true' || v === true })}
                    />
                    Write off (forgive)
                  </label>
                </div>
              </div>
            )}
          </>
        )}

        {/* Amount + method + date */}
        <div className="space-y-2">
          <Label>{isRenewal ? 'Paying now (₹)' : 'Amount (₹)'}</Label>
          <Input type="number" step="1" min="0" {...register('amount')} />
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

        {/* Live summary */}
        <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
          {isRenewal && selectedPlan && (
            <>
              <Row label="Plan price" value={formatINR(planPrice)} />
              {discountAmount > 0 && <Row label="Discount" value={`- ${formatINR(discountAmount)}`} />}
              <Row label="Final price" value={formatINR(finalPrice)} bold />
              <Row label="Paying now" value={formatINR(amountNow)} />
              {newCycleEnd && (
                <Row
                  label="New cycle ends"
                  value={format(new Date(newCycleEnd), 'dd MMM yyyy')}
                />
              )}
              <div className="my-1 border-t" />
            </>
          )}
          {!isRenewal && (
            <Row label="Pending balance" value={formatINR(oldPending)} />
          )}
          <Row
            label="Balance after this payment"
            value={formatINR(newCycleBalance)}
            bold
            warn={newCycleBalance > 0}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving...' : isRenewal ? 'Renew Membership' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function Row({
  label,
  value,
  bold,
  warn,
}: {
  label: string
  value: string
  bold?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} ${warn ? 'text-warning' : ''}`}>{value}</span>
    </div>
  )
}

