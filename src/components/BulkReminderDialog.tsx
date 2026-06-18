import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MessageCircle, SkipForward, CheckCircle2 } from 'lucide-react'
import { buildReminderMessage, openWhatsApp } from '@/lib/whatsapp'
import type { MemberWithStatus } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  members: MemberWithStatus[]
  gymName: string
}

type ItemState = 'pending' | 'sent' | 'skipped'

export function BulkReminderDialog({ open, onClose, members, gymName }: Props) {
  const [index, setIndex] = useState(0)
  const [states, setStates] = useState<ItemState[]>(() => members.map(() => 'pending'))

  // Reset state whenever the dialog is reopened with a (possibly new) list
  useEffect(() => {
    if (open) {
      setIndex(0)
      setStates(members.map(() => 'pending'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, members.length])

  if (!open) return null

  const total = members.length
  const done = states.filter((s) => s !== 'pending').length
  const current = members[index]
  const allDone = index >= total || done >= total

  const message = current
    ? buildReminderMessage(
        current.name,
        gymName,
        current.end_date,
        current.status as 'expiring_soon' | 'expired'
      )
    : ''

  function advance(state: ItemState) {
    setStates((prev) => {
      const next = [...prev]
      next[index] = state
      return next
    })
    setIndex((i) => i + 1)
  }

  function handleSend() {
    if (!current) return
    openWhatsApp(current.phone, message)
    advance('sent')
  }

  function handleSkip() {
    advance('skipped')
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Send Reminders</DialogTitle>
        <DialogDescription>
          {allDone
            ? `Done — ${states.filter((s) => s === 'sent').length} sent, ${states.filter((s) => s === 'skipped').length} skipped.`
            : `Tap "Send" to open WhatsApp for each member, one at a time.`}
        </DialogDescription>
      </DialogHeader>

      {/* Progress */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {allDone ? `${done} of ${total} processed` : `${index + 1} of ${total}`}
          </span>
          <span className="font-medium">
            {states.filter((s) => s === 'sent').length} sent
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
          />
        </div>
      </div>

      {!allDone && current ? (
        <div className="space-y-4">
          {/* Current member */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{current.name}</p>
                <p className="text-xs text-muted-foreground">{current.phone}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  current.status === 'expired'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                }`}
              >
                {current.status === 'expired' ? 'Expired' : 'Expiring'}
              </span>
            </div>
          </div>

          {/* Message preview */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Message preview</p>
            <div className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">
              {message}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1" onClick={handleSkip}>
              <SkipForward className="h-4 w-4" /> Skip
            </Button>
            <Button className="flex-1 gap-1" onClick={handleSend}>
              <MessageCircle className="h-4 w-4" /> Send WhatsApp
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="font-medium">All reminders processed</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      )}
    </Dialog>
  )
}
