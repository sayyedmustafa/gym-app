import { useState } from 'react'
import { Search, UserPlus, Phone, MessageCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuthStore } from '@/stores/auth'
import { openWhatsApp, buildReminderMessage } from '@/lib/whatsapp'
import type { MemberWithStatus, MemberStatus } from '@/types/database'

// Placeholder data
const mockMembers: MemberWithStatus[] = [
  {
    id: '1', gym_id: 'g1', name: 'Rahul Sharma', phone: '+919876543210',
    photo_url: null, plan_id: 'p1', start_date: '2025-05-01', end_date: '2025-06-01',
    notes: null, created_by: 'u1', created_at: '2025-05-01T00:00:00Z',
    status: 'expiring_soon', plan: { id: 'p1', gym_id: 'g1', name: 'Monthly', price: 1500, duration_days: 30, description: null, allows_freeze: false, max_freeze_days: 0, is_active: true, created_at: '' },
  },
  {
    id: '2', gym_id: 'g1', name: 'Priya Patel', phone: '+919876543211',
    photo_url: null, plan_id: 'p2', start_date: '2025-03-01', end_date: '2025-09-01',
    notes: null, created_by: 'u1', created_at: '2025-03-01T00:00:00Z',
    status: 'active', plan: { id: 'p2', gym_id: 'g1', name: 'Quarterly', price: 4000, duration_days: 90, description: null, allows_freeze: true, max_freeze_days: 7, is_active: true, created_at: '' },
  },
  {
    id: '3', gym_id: 'g1', name: 'Amit Kumar', phone: '+919876543212',
    photo_url: null, plan_id: 'p1', start_date: '2025-01-01', end_date: '2025-01-31',
    notes: null, created_by: 'u1', created_at: '2025-01-01T00:00:00Z',
    status: 'expired', plan: { id: 'p1', gym_id: 'g1', name: 'Monthly', price: 1500, duration_days: 30, description: null, allows_freeze: false, max_freeze_days: 0, is_active: true, created_at: '' },
  },
]

const tabs: { label: string; value: MemberStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Expiring', value: 'expiring_soon' },
  { label: 'Expired', value: 'expired' },
  { label: 'Frozen', value: 'frozen' },
]

export function MembersPage() {
  const [activeTab, setActiveTab] = useState<MemberStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const currentGym = useAuthStore((s) => s.currentGym)

  const filtered = mockMembers.filter((m) => {
    if (activeTab !== 'all' && m.status !== activeTab) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const expiringMembers = mockMembers.filter((m) => m.status === 'expiring_soon' || m.status === 'expired')

  function handleBulkWhatsApp() {
    const gymName = currentGym()?.name ?? 'our gym'
    expiringMembers.forEach((m, i) => {
      setTimeout(() => {
        const msg = buildReminderMessage(m.name, gymName, m.end_date)
        openWhatsApp(m.phone, msg)
      }, i * 500) // stagger to avoid popup blocking
    })
  }

  function handleSingleWhatsApp(member: MemberWithStatus) {
    const gymName = currentGym()?.name ?? 'our gym'
    const msg = buildReminderMessage(member.name, gymName, member.end_date)
    openWhatsApp(member.phone, msg)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground">{mockMembers.length} total members</p>
        </div>
        <div className="flex gap-2">
          {expiringMembers.length > 0 && (
            <Button variant="outline" onClick={handleBulkWhatsApp} className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Remind All ({expiringMembers.length})
            </Button>
          )}
          <Button className="gap-2">
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
            <Card key={member.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar>
                  <AvatarImage src={member.photo_url ?? undefined} />
                  <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{member.name}</p>
                    <StatusBadge status={member.status} />
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
                    onClick={() => window.open(`tel:${member.phone}`)}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="WhatsApp reminder"
                    onClick={() => handleSingleWhatsApp(member)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
