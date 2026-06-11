import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, UserPlus, Shield, ShieldCheck } from 'lucide-react'
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
          <h1 className="text-3xl font-bold">Staff & Owners</h1>
          <p className="text-muted-foreground">Manage who has access to this gym</p>
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
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar>
                  <AvatarImage src={member.profile.avatar_url ?? undefined} />
                  <AvatarFallback>{member.profile.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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
                  </div>
                  <p className="text-sm text-muted-foreground">{member.profile.email}</p>
                </div>
                {member.role === 'staff' && (
                  <Button variant="outline" size="sm">
                    Promote to Owner
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
