import { useState } from 'react'
import { Copy, Check, UserPlus, Shield, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { GymMember } from '@/types/database'

// Placeholder data
const mockStaff: (GymMember & { profile: { full_name: string; email: string; avatar_url: string | null; id: string; created_at: string } })[] = [
  { gym_id: 'g1', user_id: 'u1', role: 'owner', joined_at: '2025-01-01', profile: { id: 'u1', full_name: 'Mustafa (You)', email: 'mustafa@example.com', avatar_url: null, created_at: '2025-01-01' } },
  { gym_id: 'g1', user_id: 'u2', role: 'staff', joined_at: '2025-02-15', profile: { id: 'u2', full_name: 'Ali Khan', email: 'ali@example.com', avatar_url: null, created_at: '2025-02-15' } },
]

export function StaffPage() {
  const [copied, setCopied] = useState(false)
  const inviteCode = 'A4F9K2P7' // placeholder

  function copyInvite() {
    const link = `${window.location.origin}/onboarding?code=${inviteCode}`
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
        <CardContent>
          <div className="flex gap-2">
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Generate Invite Code
            </Button>
          </div>

          {/* Show code after generation (placeholder always shown) */}
          <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
            <code className="flex-1 font-mono text-lg tracking-widest">{inviteCode}</code>
            <Button variant="outline" size="sm" onClick={copyInvite} className="gap-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Expires in 7 days. One-time use.
          </p>
        </CardContent>
      </Card>

      {/* Staff list */}
      <div className="space-y-2">
        {mockStaff.map((member) => (
          <Card key={member.user_id}>
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar>
                <AvatarImage src={member.profile.avatar_url ?? undefined} />
                <AvatarFallback>{member.profile.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{member.profile.full_name}</p>
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
        ))}
      </div>
    </div>
  )
}
