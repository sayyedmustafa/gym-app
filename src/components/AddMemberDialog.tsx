import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Upload, X, Video } from 'lucide-react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import type { Plan } from '@/types/database'

const memberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  plan_id: z.string().min(1, 'Select a plan'),
  start_date: z.string().min(1, 'Select a start date'),
  notes: z.string().optional(),
  discount_amount: z.string().or(z.number()).optional(),
  paid_amount: z.string().or(z.number()).optional(),
  payment_method: z.enum(['cash', 'card', 'upi', 'other']).optional(),
})

type MemberFormData = z.infer<typeof memberSchema>

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  plans: Plan[]
  onSuccess?: () => void
}

export function AddMemberDialog({ open, onClose, plans, onSuccess }: AddMemberDialogProps) {
  const [loading, setLoading] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const currentGymId = useAuthStore((s) => s.currentGymId)
  const session = useAuthStore((s) => s.session)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      start_date: format(new Date(), 'yyyy-MM-dd'),
      discount_amount: 0,
      payment_method: 'cash',
    },
  })

  const selectedPlanId = watch('plan_id')
  const startDate = watch('start_date')
  const discountAmount = Number(watch('discount_amount') || 0)
  const paidAmountInput = watch('paid_amount')

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
  const endDate = selectedPlan && startDate
    ? format(addDays(new Date(startDate), selectedPlan.duration_days), 'yyyy-MM-dd')
    : ''

  const planPrice = selectedPlan ? selectedPlan.price : 0
  const finalPrice = Math.max(0, planPrice - discountAmount)
  const actualPaidAmount = paidAmountInput !== undefined && paidAmountInput !== '' ? Number(paidAmountInput) : finalPrice
  const balanceAmount = Math.max(0, finalPrice - actualPaidAmount)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraActive(true)
    } catch {
      toast.error('Could not access camera. Check browser permissions.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  function capturePhoto() {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      setPhoto(file)
      setPhotoPreview(canvas.toDataURL('image/jpeg'))
      stopCamera()
    }, 'image/jpeg', 0.8)
  }

  async function uploadPhoto(memberId: string): Promise<string | null> {
    if (!photo || !currentGymId) return null
    const ext = photo.name.split('.').pop() ?? 'jpg'
    const path = `${currentGymId}/${memberId}.${ext}`
    const { error } = await supabase.storage.from('member-photos').upload(path, photo, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('member-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function onSubmit(data: MemberFormData) {
    if (!currentGymId || !session) return
    setLoading(true)

    const plan = plans.find((p) => p.id === data.plan_id)
    const computedEndDate = plan
      ? format(addDays(new Date(data.start_date), plan.duration_days), 'yyyy-MM-dd')
      : data.start_date

    const planPrice = plan ? plan.price : 0
    const discount = Number(data.discount_amount || 0)
    const finalPrice = Math.max(0, planPrice - discount)
    const paid = data.paid_amount !== undefined && data.paid_amount !== '' ? Number(data.paid_amount) : finalPrice

    if (discount > planPrice) {
      setLoading(false)
      toast.error('Discount cannot exceed plan price')
      return
    }
    if (paid > finalPrice) {
      setLoading(false)
      toast.error('Amount paid cannot exceed final price')
      return
    }

    const balance = Math.max(0, finalPrice - paid)

    const { data: inserted, error } = await supabase.from('members').insert({
      gym_id: currentGymId,
      name: data.name,
      phone: data.phone.startsWith('+') ? data.phone : `+91${data.phone}`,
      plan_id: data.plan_id,
      start_date: data.start_date,
      end_date: computedEndDate,
      notes: data.notes || null,
      created_by: session.user.id,
      discount_amount: discount,
      paid_amount: paid,
      balance_amount: balance,
    }).select('id').single()

    if (error) {
      setLoading(false)
      toast.error('Failed to add member', { description: error.message })
      return
    }

    // Record payment if any amount was paid
    if (inserted && paid > 0) {
      const { error: paymentError } = await supabase.from('payments').insert({
        gym_id: currentGymId,
        member_id: inserted.id,
        plan_id: data.plan_id,
        amount: paid,
        method: data.payment_method || 'cash',
        paid_on: data.start_date,
        extends_to: computedEndDate,
        created_by: session.user.id,
      })

      if (paymentError) {
        console.error('Failed to log payment:', paymentError)
        toast.warning('Member added, but failed to log payment record.')
      }
    }

    // Upload photo if selected
    if (photo && inserted) {
      const photoUrl = await uploadPhoto(inserted.id)
      if (photoUrl) {
        await supabase.from('members').update({ photo_url: photoUrl }).eq('id', inserted.id)
      }
    }

    setLoading(false)
    toast.success('Member added successfully!')
    reset()
    setPhoto(null)
    setPhotoPreview(null)
    stopCamera()
    onClose()
    onSuccess?.()
  }

  function handleClose() {
    reset()
    setPhoto(null)
    setPhotoPreview(null)
    stopCamera()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>Add New Member</DialogTitle>
        <DialogDescription>Fill in the member's details to register them.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Photo upload/capture */}
        <div className="space-y-2">
          <Label>Profile Photo</Label>
          {cameraActive ? (
            <div className="space-y-2">
              <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-[280px] rounded-lg border" />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={capturePhoto} className="gap-1">
                  <Camera className="h-3.5 w-3.5" /> Take Photo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="h-20 w-20 rounded-full object-cover border" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border border-dashed">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={startCamera}>
                  <Video className="h-3.5 w-3.5" /> Capture
                </Button>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
          <Input id="name" placeholder="e.g. Rahul Sharma" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
          <Input id="phone" placeholder="+919876543210" {...register('phone')} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="plan_id">Membership Plan <span className="text-destructive">*</span></Label>
          <Select id="plan_id" {...register('plan_id')}>
            <option value="">Select a plan</option>
            {plans.filter((p) => p.is_active).map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — ₹{plan.price} / {plan.duration_days} days
              </option>
            ))}
          </Select>
          {errors.plan_id && <p className="text-xs text-destructive">{errors.plan_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date <span className="text-destructive">*</span></Label>
          <Input id="start_date" type="date" {...register('start_date')} />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
        </div>

        {endDate && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Membership ends:</span>{' '}
            <span className="font-medium">{endDate}</span>
            {selectedPlan && (
              <span className="text-muted-foreground"> ({selectedPlan.duration_days} days)</span>
            )}
          </div>
        )}

        {selectedPlan && (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-4">
            <h3 className="font-semibold text-sm leading-none tracking-tight">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_amount">Discount (₹)</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  placeholder="0"
                  {...register('discount_amount')}
                />
                {errors.discount_amount && (
                  <p className="text-xs text-destructive">{errors.discount_amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_amount">Amount Paid (₹)</Label>
                <Input
                  id="paid_amount"
                  type="number"
                  placeholder={finalPrice.toString()}
                  {...register('paid_amount')}
                />
                {errors.paid_amount && (
                  <p className="text-xs text-destructive">{errors.paid_amount.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select id="payment_method" {...register('payment_method')}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="other">Other</option>
              </Select>
              {errors.payment_method && (
                <p className="text-xs text-destructive">{errors.payment_method.message}</p>
              )}
            </div>

            <div className="text-xs space-y-1.5 border-t pt-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan Base Price:</span>
                <span>₹{planPrice}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Discount:</span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Final Price:</span>
                <span>₹{finalPrice}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Paid Amount:</span>
                <span>₹{actualPaidAmount}</span>
              </div>
              {balanceAmount > 0 && (
                <div className="flex justify-between text-amber-600 font-semibold border-t border-dashed pt-1.5 mt-1.5">
                  <span>Pending Balance:</span>
                  <span>₹{balanceAmount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" placeholder="Any additional notes..." {...register('notes')} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Adding...' : 'Add Member'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
