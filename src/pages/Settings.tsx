import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Upload, X, Dumbbell, RotateCcw } from 'lucide-react'
import {
  getExpiringTemplate,
  getExpiredTemplate,
  setExpiringTemplate,
  setExpiredTemplate,
  getDefaultExpiringTemplate,
  getDefaultExpiredTemplate,
} from '@/lib/whatsapp'

export function SettingsPage() {
  const { profile, currentGym, isOwner, session, currentGymId, setGyms, gyms } = useAuthStore()
  const gym = currentGym()
  const navigate = useNavigate()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(false)

  const [gymName, setGymName] = useState(gym?.name ?? '')
  const [gymAddress, setGymAddress] = useState(gym?.address ?? '')
  const [gymPhone, setGymPhone] = useState(gym?.phone ?? '')
  const [gymEmail, setGymEmail] = useState(gym?.email ?? '')
  const [savingGym, setSavingGym] = useState(false)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [expiringTpl, setExpiringTpl] = useState(getExpiringTemplate)
  const [expiredTpl, setExpiredTpl] = useState(getExpiredTemplate)

  useEffect(() => {
    if (gym) {
      setGymName(gym.name)
      setGymAddress(gym.address ?? '')
      setGymPhone(gym.phone ?? '')
      setGymEmail(gym.email ?? '')
      setLogoFile(null)
      setLogoPreview(null)
      setLogoRemoved(false)
    }
  }, [gym])

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoRemoved(false)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoRemoved(true)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleSaveGymDetails() {
    if (!currentGymId) return
    if (!gymName.trim()) {
      toast.error('Gym name is required')
      return
    }

    setSavingGym(true)

    let uploadedLogoUrl = gym?.logo_url || null
    if (logoRemoved) {
      uploadedLogoUrl = null
    } else if (logoFile) {
      const ext = logoFile.name.split('.').pop() ?? 'jpg'
      const path = `${currentGymId}/logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(path, logoFile, { upsert: true })

      if (uploadError) {
        toast.error('Failed to upload logo', { description: uploadError.message })
        setSavingGym(false)
        return
      }

      const { data } = supabase.storage.from('member-photos').getPublicUrl(path)
      uploadedLogoUrl = data.publicUrl
    }

    const { error } = await supabase
      .from('gyms')
      .update({
        name: gymName.trim(),
        address: gymAddress.trim() || null,
        phone: gymPhone.trim() || null,
        email: gymEmail.trim() || null,
        logo_url: uploadedLogoUrl,
      })
      .eq('id', currentGymId)

    setSavingGym(false)

    if (error) {
      toast.error('Failed to update gym details', { description: error.message })
      return
    }

    toast.success('Gym details updated successfully')
    setGyms(
      gyms.map((g) =>
        g.id === currentGymId
          ? {
              ...g,
              name: gymName.trim(),
              address: gymAddress.trim() || null,
              phone: gymPhone.trim() || null,
              email: gymEmail.trim() || null,
              logo_url: uploadedLogoUrl,
            }
          : g
      )
    )
  }

  async function handleLeaveGym() {
    if (!currentGymId || !session) return
    setLoading(true)
    const { error } = await supabase
      .from('gym_members')
      .delete()
      .eq('gym_id', currentGymId)
      .eq('user_id', session.user.id)

    setLoading(false)
    if (error) {
      toast.error('Failed to leave gym', { description: error.message })
      return
    }

    toast.success('You have left the gym')
    setGyms(gyms.filter((g) => g.id !== currentGymId))
    setConfirmLeave(false)
    navigate('/onboarding')
  }

  async function handleDeleteGym() {
    if (!currentGymId) return
    setLoading(true)

    // Delete in order: members, plans, gym_members, then the gym itself
    await supabase.from('members').delete().eq('gym_id', currentGymId)
    await supabase.from('plans').delete().eq('gym_id', currentGymId)
    await supabase.from('gym_members').delete().eq('gym_id', currentGymId)
    const { error } = await supabase.from('gyms').delete().eq('id', currentGymId)

    setLoading(false)
    if (error) {
      toast.error('Failed to delete gym', { description: error.message })
      return
    }

    toast.success('Gym deleted permanently')
    setGyms(gyms.filter((g) => g.id !== currentGymId))
    setConfirmDelete(false)
    navigate('/onboarding')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your gym and profile settings</p>
      </div>

      {/* Gym settings (owner only) */}
      {isOwner() && (
        <Card>
          <CardHeader>
            <CardTitle>Gym Details</CardTitle>
            <CardDescription>Update your gym's name and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gym Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo Preview" className="h-16 w-16 rounded object-cover border" />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-white"
                      disabled={savingGym}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : gym?.logo_url ? (
                  <div className="relative">
                    <img src={gym.logo_url} alt="Logo" className="h-16 w-16 rounded object-cover border" />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-white"
                      disabled={savingGym}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded bg-muted flex items-center justify-center border border-dashed">
                    <Dumbbell className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={savingGym}
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Logo
                  </Button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Gym Name</label>
              <Input
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="Gym name"
                disabled={savingGym}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={gymPhone}
                onChange={(e) => setGymPhone(e.target.value)}
                placeholder="e.g. +1 (555) 000-0000"
                disabled={savingGym}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                value={gymEmail}
                onChange={(e) => setGymEmail(e.target.value)}
                placeholder="e.g. contact@gym.com"
                disabled={savingGym}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={gymAddress}
                onChange={(e) => setGymAddress(e.target.value)}
                placeholder="e.g. 123 Main St, City, Country"
                disabled={savingGym}
              />
            </div>
            <Button onClick={handleSaveGymDetails} disabled={savingGym}>
              {savingGym ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Message Templates (owner only) */}
      {isOwner() && (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Message Templates</CardTitle>
            <CardDescription>
              Customize reminder messages. Use placeholders: <code className="text-xs bg-muted px-1 rounded">{'{name}'}</code> <code className="text-xs bg-muted px-1 rounded">{'{gymName}'}</code> <code className="text-xs bg-muted px-1 rounded">{'{endDate}'}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Expiring Plan Message</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={expiringTpl}
                onChange={(e) => setExpiringTpl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expired Plan Message</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={expiredTpl}
                onChange={(e) => setExpiredTpl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setExpiringTemplate(expiringTpl)
                  setExpiredTemplate(expiredTpl)
                  toast.success('Message templates saved!')
                }}
              >
                Save Templates
              </Button>
              <Button
                variant="outline"
                className="gap-1"
                onClick={() => {
                  setExpiringTpl(getDefaultExpiringTemplate())
                  setExpiredTpl(getDefaultExpiredTemplate())
                  setExpiringTemplate(getDefaultExpiringTemplate())
                  setExpiredTemplate(getDefaultExpiredTemplate())
                  toast.success('Templates reset to default')
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Your account information from Google</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={profile?.full_name ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={profile?.email ?? ''} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Leave this gym</p>
              <p className="text-sm text-muted-foreground">You will lose access to all gym data</p>
            </div>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmLeave(true)}>
              Leave Gym
            </Button>
          </div>
          {isOwner() && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete this gym</p>
                <p className="text-sm text-muted-foreground">Permanently delete the gym and all its data</p>
              </div>
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete Gym
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave confirmation */}
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <DialogHeader>
          <DialogTitle>Leave Gym?</DialogTitle>
          <DialogDescription>
            You will lose access to <strong>{gym?.name}</strong> and all its data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setConfirmLeave(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleLeaveGym} disabled={loading}>
            {loading ? 'Leaving...' : 'Yes, Leave'}
          </Button>
        </div>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogHeader>
          <DialogTitle>Delete Gym?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{gym?.name}</strong>, all members, plans, and payment records. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteGym} disabled={loading}>
            {loading ? 'Deleting...' : 'Yes, Delete Everything'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
