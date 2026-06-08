import type { MemberStatus } from '@/types/database'
import { Badge } from '@/components/ui/badge'

const statusConfig: Record<MemberStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  active: { label: 'Active', variant: 'success' },
  expiring_soon: { label: 'Expiring', variant: 'warning' },
  expired: { label: 'Expired', variant: 'destructive' },
  frozen: { label: 'Frozen', variant: 'secondary' },
}

interface StatusBadgeProps {
  status: MemberStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
