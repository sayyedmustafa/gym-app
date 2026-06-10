import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'

const planSchema = z.object({
  name: z.string().min(2, 'Plan name is required'),
  price: z.coerce.number().min(1, 'Price must be at least ₹1'),
  duration_days: z.coerce.number().min(1, 'Duration must be at least 1 day'),
  description: z.string().optional(),
  allows_freeze: z.boolean().optional(),
  max_freeze_days: z.coerce.number().min(0).optional(),
})

type PlanFormData = z.infer<typeof planSchema>

interface AddPlanDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddPlanDialog({ open, onClose, onSuccess }: AddPlanDialogProps) {
  const [loading, setLoading] = useState(false)
  const currentGymId = useAuthStore((s) => s.currentGymId)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      allows_freeze: false,
      max_freeze_days: 0,
    },
  })

  const allowsFreeze = watch('allows_freeze')

  async function onSubmit(data: PlanFormData) {
    if (!currentGymId) return
    setLoading(true)

    const { error } = await supabase.from('plans').insert({
      gym_id: currentGymId,
      name: data.name,
      price: data.price,
      duration_days: data.duration_days,
      description: data.description || null,
      allows_freeze: data.allows_freeze ?? false,
      max_freeze_days: data.allows_freeze ? (data.max_freeze_days ?? 0) : 0,
      is_active: true,
    })

    setLoading(false)

    if (error) {
      toast.error('Failed to create plan', { description: error.message })
      return
    }

    toast.success('Plan created successfully!')
    reset()
    onClose()
    onSuccess?.()
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>Create Membership Plan</DialogTitle>
        <DialogDescription>Set up pricing, duration, and freeze options.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="plan-name">Plan Name</Label>
          <Input id="plan-name" placeholder="e.g. Monthly, Quarterly, Yearly" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price (₹)</Label>
            <Input id="price" type="number" placeholder="1500" {...register('price')} />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (days)</Label>
            <Input id="duration" type="number" placeholder="30" {...register('duration_days')} />
            {errors.duration_days && <p className="text-xs text-destructive">{errors.duration_days.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input id="description" placeholder="Basic gym access..." {...register('description')} />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <input
              id="allows_freeze"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register('allows_freeze')}
            />
            <Label htmlFor="allows_freeze" className="cursor-pointer">Allow membership freeze/pause</Label>
          </div>

          {allowsFreeze && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="max_freeze_days">Max freeze days</Label>
              <Input
                id="max_freeze_days"
                type="number"
                placeholder="7"
                className="w-32"
                {...register('max_freeze_days')}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Creating...' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
