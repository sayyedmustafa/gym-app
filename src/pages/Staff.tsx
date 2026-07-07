import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, UserPlus, Shield, ShieldCheck, Crown, UserX, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { GymMember, Invite } from '@/types/database'

type StaffMember = GymMember & {
  profile: { id: string; full_name: string; email: string; avatar_url: string | null; created_at: string }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function StaffPage() {
  const [copied, setCopied] = useState(false)
  const currentGymId = useAuthStore((s) => s.currentGymId)
  const currentGym = useAuthStore((s) => s.currentGym())
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff', currentGymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('gym_members')
        .select('*, profile:profiles(*)')
        .eq('gym_id', currentGymId!)
      return (data ?? []) as StaffMember[]
    },
    enabled: !!currentGymId,
  })

  // Fetch active (unused, not expired) invite
  const { data: activeInvite } = useQuery<Invite | null>({
    queryKey: ['invite', currentGymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('invites')
        .select('*')
        .eq('gym_id', currentGymId!)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as Invite | null
    },
    enabled: !!currentGymId,
  })

  const generateInvite = useMutation({
    mutationFn: async () => {
      const code = generateCode()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('invites').insert({
        gym_id: currentGymId!,
        code,
        role: 'staff' as const,
        expires_at: expiresAt,
        created_by: session!.user.id,
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite', currentGymId] })
      toast.success('Invite code generated!')
    },
    onError: (err: any) => {
      toast.error('Failed to generate invite', { description: err.message })
    },
  })

  // Owner Prime = gym creator if known, else earliest owner by joined_at.
  const ownerPrimeId = useMemo(() => {
    const owners = staff.filter((m) => m.role === 'owner')
    if (owners.length === 0) return null
    const gymCreatedBy = (currentGym as { created_by?: string | null } | null)?.created_by
    if (gymCreatedBy && owners.some((o) => o.user_id === gymCreatedBy)) return gymCreatedBy
    return owners
      .slice()
      .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())[0]?.user_id ?? null
  }, [staff, currentGym])

  const myMember = useMemo(
    () => staff.find((m) => m.user_id === session?.user.id) ?? null,
    [staff, session?.user.id]
  )
  const isCurrentUserOwner = myMember?.role === 'owner'
  const isCurrentUserPrime = !!session?.user.id && session.user.id === ownerPrimeId

  function isMemberPrime(member: StaffMember) {
    return !!ownerPrimeId && member.user_id === ownerPrimeId
  }

  function canPromote(member: StaffMember) {
    return isCurrentUserPrime && member.role === 'staff'
  }

  function canDemote(member: StaffMember) {
    if (!isCurrentUserPrime) return false
    if (member.role !== 'owner') return false
    if (isMemberPrime(member)) return false
    return true
  }

  function canKick(member: StaffMember) {
    if (!isCurrentUserOwner) return false
    if (isMemberPrime(member)) return false
    if (member.role === 'staff') return true
    if (member.role === 'owner') return isCurrentUserPrime && member.user_id !== session?.user.id
    return false
  }

  async function handlePromote(member: StaffMember) {
    if (!currentGymId) return toast.error('No gym selected')
    if (!canPromote(member)) return toast.error('Only Owner Prime can promote staff to owner')
    const { error } = await supabase
      .from('gym_members')
      .update({ role: 'owner' })
      .eq('gym_id', currentGymId)
      .eq('user_id', member.user_id)
    if (error) return toast.error('Failed to promote', { description: error.message })
    toast.success(`${member.profile.full_name} is now an Owner!`)
    queryClient.invalidateQueries({ queryKey: ['staff', currentGymId] })
  }

  async function handleDemote(member: StaffMember) {
    if (!currentGymId) return toast.error('No gym selected')
    if (!canDemote(member)) return toast.error('Only Owner Prime can demote owners. Owner Prime cannot be demoted.')
    const { error } = await supabase
      .from('gym_members')
      .update({ role: 'staff' })
      .eq('gym_id', currentGymId)
      .eq('user_id', member.user_id)
    if (error) return toast.error('Failed to demote owner', { description: error.message })
    toast.success(`${member.profile.full_name} is now Staff`)
    queryClient.invalidateQueries({ queryKey: ['staff', currentGymId] })
  }

  async function handleKick(member: StaffMember) {
    if (!currentGymId) return toast.error('No gym selected')
    if (!canKick(member)) {
      return toast.error(
        member.role === 'owner'
          ? 'Only Owner Prime can kick another owner. Owner Prime cannot be removed.'
          : 'Only owners can kick staff members.'
      )
    }
    const confirmed = window.confirm(`Remove ${member.profile.full_name} from this gym?`)
    if (!confirmed) return
    const { error } = await supabase
      .from('gym_members')
      .delete()
      .eq('gym_id', currentGymId)
      .eq('user_id', member.user_id)
    if (error) return toast.error('Failed to remove member', { description: error.message })
    toast.success(`${member.profile.full_name} has been removed`)
    queryClient.invalidateQueries({ queryKey: ['staff', currentGymId] })
  }

  function copyInvite() {
    if (!activeInvite) return
    const link = `${window.location.origin}${import.meta.env.BASE_URL}onboarding?code=${activeInvite.code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Staff & Owners</h1>
          <p className="text-sm text-muted-foreground md:text-base">Manage who has access to this gym</p>
        </div>
      </div>

      {/* Generate invite card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite someone</CardTitle>
          <CardDescription>
            Generate an invite code. Share the link — they sign in with Google and join automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeInvite ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <code className="flex-1 font-mono text-lg tracking-widest">{activeInvite.code}</code>
                <Button variant="outline" size="sm" onClick={copyInvite} className="gap-1">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(activeInvite.expires_at).toLocaleDateString()}. One-time use.
              </p>
            </>
          ) : (
            <Button
              className="gap-2"
              onClick={() => generateInvite.mutate()}
              disabled={generateInvite.isPending}
            >
              <UserPlus className="h-4 w-4" />
              {generateInvite.isPending ? 'Generating...' : 'Generate Invite Code'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Staff list */}
      <div className="space-y-2">
        {staff.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No staff members yet. Share the invite link to add people.
            </CardContent>
          </Card>
        ) : (
          staff.map((member) => (
            <Card key={member.user_id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <Avatar>
                    <AvatarImage src={member.profile.avatar_url ?? undefined} />
                    <AvatarFallback>{member.profile.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">
                        {member.profile.full_name}
                        {member.user_id === session?.user.id && ' (You)'}
                      </p>
                      <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                        {member.role === 'owner' ? (
                          <><ShieldCheck className="mr-1 h-3 w-3" />Owner</>
                        ) : (
                          <><Shield className="mr-1 h-3 w-3" />Staff</>
                        )}
                      </Badge>
                      {isMemberPrime(member) && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          <Crown className="mr-1 h-3 w-3" />Owner Prime
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.profile.email}</p>
                  </div>
                </div>
                {(canPromote(member) || canDemote(member) || canKick(member)) && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {canPromote(member) && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePromote(member)}>
                        <ShieldCheck className="h-4 w-4" />
                        Promote to Owner
                      </Button>
                    )}
                    {canDemote(member) && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDemote(member)}>
                        <ArrowDownToLine className="h-4 w-4" />
                        Demote to Staff
                      </Button>
                    )}
                    {canKick(member) && (
                      <Button variant="destructive" size="sm" className="gap-1" onClick={() => handleKick(member)}>
                        <UserX className="h-4 w-4" />
                        Kick
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
