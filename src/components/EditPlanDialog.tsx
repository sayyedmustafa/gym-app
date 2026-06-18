import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Plan } from '@/types/database'

const planSchema = z.object({
  name: z.string().min(2, 'Plan name is required'),
  price: z.coerce.number().min(1, 'Price must be at least ₹1'),
  duration_days: z.coerce.number().min(1, 'Duration must be at least 1 day'),
  description: z.string().optional(),
  allows_freeze: z.boolean().optional(),
  max_freeze_days: z.coerce.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

type PlanFormData = z.infer<typeof planSchema>
type PlanFormInput = z.input<typeof planSchema>

interface EditPlanDialogProps {
  open: boolean
  onClose: () => void
  plan: Plan
  onSuccess?: () => void
}

export function EditPlanDialog({ open, onClose, plan, onSuccess }: EditPlanDialogProps) {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PlanFormInput, unknown, PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: plan.name,
      price: plan.price,
      duration_days: plan.duration_days,
      description: plan.description ?? '',
      allows_freeze: plan.allows_freeze,
      max_freeze_days: plan.max_freeze_days,
      is_active: plan.is_active,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: plan.name,
        price: plan.price,
        duration_days: plan.duration_days,
        description: plan.description ?? '',
        allows_freeze: plan.allows_freeze,
        max_freeze_days: plan.max_freeze_days,
        is_active: plan.is_active,
      })
    }
  }, [open, plan.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const allowsFreeze = watch('allows_freeze')

  async function onSubmit(data: PlanFormData) {
    setLoading(true)

    const { error } = await supabase
      .from('plans')
      .update({
        name: data.name,
        price: data.price,
        duration_days: data.duration_days,
        description: data.description || null,
        allows_freeze: data.allows_freeze ?? false,
        max_freeze_days: data.allows_freeze ? (data.max_freeze_days ?? 0) : 0,
        is_active: data.is_active ?? true,
      })
      .eq('id', plan.id)

    setLoading(false)

    if (error) {
      toast.error('Failed to update plan', { description: error.message })
      return
    }

    toast.success('Plan updated')
    onClose()
    onSuccess?.()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Edit Membership Plan</DialogTitle>
        <DialogDescription>Changes apply to new sign-ups. Existing members keep their current dates.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-plan-name">Plan Name</Label>
          <Input id="edit-plan-name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-price">Price (₹)</Label>
            <Input id="edit-price" type="number" {...register('price')} />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-duration">Duration (days)</Label>
            <Input id="edit-duration" type="number" {...register('duration_days')} />
            {errors.duration_days && <p className="text-xs text-destructive">{errors.duration_days.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-description">Description (optional)</Label>
          <Input id="edit-description" {...register('description')} />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <input
              id="edit-allows_freeze"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register('allows_freeze')}
            />
            <Label htmlFor="edit-allows_freeze" className="cursor-pointer">Allow membership freeze/pause</Label>
          </div>
          {allowsFreeze && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="edit-max_freeze_days">Max freeze days</Label>
              <Input
                id="edit-max_freeze_days"
                type="number"
                className="w-32"
                {...register('max_freeze_days')}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-md border p-3">
          <input
            id="edit-is_active"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            {...register('is_active')}
          />
          <Label htmlFor="edit-is_active" className="cursor-pointer">
            Active — appears in member sign-up
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
