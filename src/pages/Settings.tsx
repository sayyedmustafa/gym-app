import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function SettingsPage() {
  const { profile, currentGym, isOwner } = useAuthStore()
  const gym = currentGym()

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
            <CardDescription>Update your gym's name and information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gym Name</label>
              <Input defaultValue={gym?.name ?? ''} placeholder="Gym name" />
            </div>
            <Button>Save Changes</Button>
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
            <Button variant="outline" className="text-destructive hover:text-destructive">
              Leave Gym
            </Button>
          </div>
          {isOwner() && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete this gym</p>
                <p className="text-sm text-muted-foreground">Permanently delete the gym and all its data</p>
              </div>
              <Button variant="destructive">
                Delete Gym
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
