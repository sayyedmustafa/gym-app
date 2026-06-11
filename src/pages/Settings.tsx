import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'

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

  useEffect(() => {
    if (gym) {
      setGymName(gym.name)
      setGymAddress(gym.address ?? '')
      setGymPhone(gym.phone ?? '')
      setGymEmail(gym.email ?? '')
    }
  }, [gym])

  async function handleSaveGymDetails() {
    if (!currentGymId) return
    if (!gymName.trim()) {
      toast.error('Gym name is required')
      return
    }

    setSavingGym(true)
    const { error } = await supabase
      .from('gyms')
      .update({
        name: gymName.trim(),
        address: gymAddress.trim() || null,
        phone: gymPhone.trim() || null,
        email: gymEmail.trim() || null,
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
