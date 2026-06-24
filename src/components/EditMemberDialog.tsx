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
import { ImageLightbox } from '@/components/ImageLightbox'
import { PaymentHistoryList } from '@/components/PaymentHistoryList'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import { formatINR } from '@/lib/utils'
import type { MemberWithStatus, Plan } from '@/types/database'

const editSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  plan_id: z.string().min(1, 'Select a plan'),
  start_date: z.string().min(1, 'Select a start date'),
  notes: z.string().optional(),
})

type EditFormData = z.infer<typeof editSchema>

interface EditMemberDialogProps {
  open: boolean
  onClose: () => void
  member: MemberWithStatus
  plans: Plan[]
  onSuccess?: () => void
}

export function EditMemberDialog({ open, onClose, member, plans, onSuccess }: EditMemberDialogProps) {
  const [loading, setLoading] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(member.photo_url)
  const [cameraActive, setCameraActive] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const currentGymId = useAuthStore((s) => s.currentGymId)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: member.name,
      phone: member.phone,
      plan_id: member.plan_id ?? '',
      start_date: member.start_date,
      notes: member.notes ?? '',
    },
  })

  const selectedPlanId = watch('plan_id')
  const startDate = watch('start_date')
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
  const endDate = selectedPlan && startDate
    ? format(addDays(new Date(startDate), selectedPlan.duration_days), 'yyyy-MM-dd')
    : member.end_date

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

  async function uploadPhoto(): Promise<string | null> {
    if (!photo || !currentGymId) return null
    const ext = photo.name.split('.').pop() ?? 'jpg'
    const path = `${currentGymId}/${member.id}.${ext}`
    const { error } = await supabase.storage.from('member-photos').upload(path, photo, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('member-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function onSubmit(data: EditFormData) {
    if (!currentGymId) return
    setLoading(true)

    const plan = plans.find((p) => p.id === data.plan_id)
    const computedEndDate = plan
      ? format(addDays(new Date(data.start_date), plan.duration_days), 'yyyy-MM-dd')
      : member.end_date

    const updates: Record<string, any> = {
      name: data.name,
      phone: data.phone.startsWith('+') ? data.phone : `+91${data.phone}`,
      plan_id: data.plan_id,
      start_date: data.start_date,
      end_date: computedEndDate,
      notes: data.notes || null,
    }

    // Upload new photo if changed
    if (photo) {
      const photoUrl = await uploadPhoto()
      if (photoUrl) updates.photo_url = photoUrl
    } else if (photoPreview === null && member.photo_url) {
      // Photo was removed
      updates.photo_url = null
    }

    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', member.id)

    setLoading(false)

    if (error) {
      toast.error('Failed to update member', { description: error.message })
      return
    }

    toast.success('Member updated successfully!')
    stopCamera()
    onClose()
    onSuccess?.()
  }

  function handleClose() {
    stopCamera()
    onClose()
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>Update {member.name}'s details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Photo section */}
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
                    <img
                      src={photoPreview}
                      alt={member.name}
                      className="h-20 w-20 rounded-full object-cover border cursor-pointer hover:ring-2 hover:ring-primary transition"
                      onClick={() => setLightboxOpen(true)}
                    />
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
            <Label htmlFor="edit-name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="edit-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone Number <span className="text-destructive">*</span></Label>
            <Input id="edit-phone" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-plan">Membership Plan <span className="text-destructive">*</span></Label>
            <Select id="edit-plan" {...register('plan_id')}>
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
            <Label htmlFor="edit-start">Start Date <span className="text-destructive">*</span></Label>
            <Input id="edit-start" type="date" {...register('start_date')} />
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

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Input id="edit-notes" {...register('notes')} />
          </div>

          {/* Payment history */}
          <div className="space-y-2 border-t pt-4">
            <div>
              <Label>Payment History</Label>
              {member.balance_amount !== undefined && member.balance_amount > 0 && (
                <p className="text-xs text-warning">Pending balance: {formatINR(member.balance_amount)}</p>
              )}
            </div>
            <PaymentHistoryList member={member} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      {lightboxOpen && photoPreview && (
        <ImageLightbox src={photoPreview} alt={member.name} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  )
}
