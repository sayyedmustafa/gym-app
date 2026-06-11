import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefilledCode = searchParams.get('code') ?? ''

  const [mode, setMode] = useState<'choice' | 'create' | 'join'>(
    prefilledCode ? 'join' : 'choice'
  )
  const [gymName, setGymName] = useState('')
  const [inviteCode, setInviteCode] = useState(prefilledCode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { setGyms, setCurrentGymId, gyms, initialized } = useAuthStore()

  useEffect(() => {
    if (initialized && gyms.length > 0) {
      navigate('/app', { replace: true })
    }
  }, [initialized, gyms, navigate])

  async function handleCreateGym() {
    if (!gymName.trim()) return setError('Enter a gym name')
    setLoading(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('create_gym', {
      p_name: gymName.trim(),
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    // Fetch updated gyms
    const gymId = data as string
    setGyms([{ id: gymId, name: gymName.trim(), role: 'owner', created_at: new Date().toISOString() }])
    setCurrentGymId(gymId)
    navigate('/app')
  }

  async function handleJoinGym() {
    if (!inviteCode.trim()) return setError('Enter an invite code')
    setLoading(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('redeem_invite', {
      p_code: inviteCode.trim(),
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    const gymId = data as string
    // We don't know the gym name here — in real flow we'd fetch it
    setGyms([{ id: gymId, name: 'Joined Gym', role: 'staff', created_at: new Date().toISOString() }])
    setCurrentGymId(gymId)
    navigate('/app')
  }

  if (mode === 'choice') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
        <div className="w-full max-w-lg space-y-4">
          <div className="text-center mb-8">
            <Dumbbell className="mx-auto h-12 w-12 text-primary mb-4" />
            <h1 className="text-2xl font-bold">Welcome to GymManager</h1>
            <p className="text-muted-foreground">Create a new gym or join an existing one</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode('create')}>
              <CardHeader className="text-center">
                <Dumbbell className="mx-auto h-8 w-8 text-primary" />
                <CardTitle className="text-lg">Create a Gym</CardTitle>
                <CardDescription>I'm the owner setting up my gym</CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode('join')}>
              <CardHeader className="text-center">
                <UserPlus className="mx-auto h-8 w-8 text-primary" />
                <CardTitle className="text-lg">Join a Gym</CardTitle>
                <CardDescription>I have an invite code from the owner</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === 'create' ? 'Create your Gym' : 'Join a Gym'}</CardTitle>
          <CardDescription>
            {mode === 'create'
              ? 'Give your gym a name to get started'
              : 'Enter the invite code shared by the gym owner'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'create' ? (
            <Input
              placeholder="e.g. Iron Paradise Gym"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGym()}
            />
          ) : (
            <Input
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGym()}
              className="tracking-widest text-center uppercase"
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMode('choice')} disabled={loading}>
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={mode === 'create' ? handleCreateGym : handleJoinGym}
              disabled={loading}
            >
              {loading ? 'Please wait...' : mode === 'create' ? 'Create Gym' : 'Join Gym'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
