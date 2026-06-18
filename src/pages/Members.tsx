import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, Phone, MessageCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/StatusBadge'
import { AddMemberDialog } from '@/components/AddMemberDialog'
import { EditMemberDialog } from '@/components/EditMemberDialog'
import { ImageLightbox } from '@/components/ImageLightbox'
import { BulkReminderDialog } from '@/components/BulkReminderDialog'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { openWhatsApp, buildReminderMessage } from '@/lib/whatsapp'
import { differenceInDays } from 'date-fns'
import type { MemberWithStatus, MemberStatus, Plan } from '@/types/database'

const tabs: { label: string; value: MemberStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Expiring', value: 'expiring_soon' },
  { label: 'Expired', value: 'expired' },
  { label: 'Frozen', value: 'frozen' },
]

function computeStatus(endDate: string): MemberStatus {
  const daysLeft = differenceInDays(new Date(endDate), new Date())
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 7) return 'expiring_soon'
  return 'active'
}

export function MembersPage() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<MemberStatus | 'all'>(() => {
    const s = searchParams.get('status') as MemberStatus | null
    return s && ['active', 'expiring_soon', 'expired', 'frozen'].includes(s) ? s : 'all'
  })
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMember, setEditMember] = useState<MemberWithStatus | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const currentGymId = useAuthStore((s) => s.currentGymId)
  const currentGym = useAuthStore((s) => s.currentGym)

  // Keep tab in sync if URL changes (e.g. nav from dashboard banner while page already mounted)
  useEffect(() => {
    const s = searchParams.get('status') as MemberStatus | null
    if (s && ['active', 'expiring_soon', 'expired', 'frozen'].includes(s)) {
      setActiveTab(s)
    }
  }, [searchParams])

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans', currentGymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .eq('gym_id', currentGymId!)
      return (data ?? []) as Plan[]
    },
    enabled: !!currentGymId,
  })

  const { data: members = [], refetch: refetchMembers } = useQuery<MemberWithStatus[]>({
    queryKey: ['members', currentGymId],
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('*, plan:plans(*)')
        .eq('gym_id', currentGymId!)
        .order('created_at', { ascending: false })
      return (data ?? []).map((m: any) => ({
        ...m,
        status: computeStatus(m.end_date),
      })) as MemberWithStatus[]
    },
    enabled: !!currentGymId,
  })

  const filtered = members.filter((m) => {
    if (activeTab !== 'all' && m.status !== activeTab) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const expiringMembers = members.filter((m) => m.status === 'expiring_soon' || m.status === 'expired')

  function handleSingleWhatsApp(member: MemberWithStatus) {
    const gymName = currentGym()?.name ?? 'our gym'
    const msg = buildReminderMessage(member.name, gymName, member.end_date, member.status as 'expiring_soon' | 'expired')
    openWhatsApp(member.phone, msg)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground">{members.length} total members</p>
        </div>
        <div className="flex gap-2">
          {expiringMembers.length > 0 && (
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Remind All ({expiringMembers.length})
            </Button>
          )}
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Member list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">No members found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((member) => (
            <Card key={member.id} className="cursor-pointer hover:border-primary/50 transition" onClick={() => setEditMember(member)}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar
                  className="cursor-pointer hover:ring-2 hover:ring-primary transition"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (member.photo_url) setLightboxSrc(member.photo_url)
                  }}
                >
                  <AvatarImage src={member.photo_url ?? undefined} />
                  <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{member.name}</p>
                    <StatusBadge status={member.status} />
                    {member.balance_amount !== undefined && member.balance_amount > 0 && (
                      <span className="text-xs font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                        Pending: ₹{member.balance_amount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {member.plan?.name ?? 'No plan'} · Ends {member.end_date}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Call"
                    onClick={(e) => { e.stopPropagation(); window.open(`tel:${member.phone}`) }}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="WhatsApp reminder"
                    onClick={(e) => { e.stopPropagation(); handleSingleWhatsApp(member) }}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddMemberDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        plans={plans}
        onSuccess={() => refetchMembers()}
      />

      {editMember && (
        <EditMemberDialog
          open={!!editMember}
          onClose={() => setEditMember(null)}
          member={editMember}
          plans={plans}
          onSuccess={async () => {
            const { data: fresh } = await refetchMembers()
            const updated = fresh?.find((m) => m.id === editMember.id) ?? null
            setEditMember(updated)
          }}
        />
      )}

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      <BulkReminderDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        members={expiringMembers}
        gymName={currentGym()?.name ?? 'our gym'}
      />
    </div>
  )
}
