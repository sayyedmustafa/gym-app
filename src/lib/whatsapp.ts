/**
 * WhatsApp deep-link utilities
 */

const DEFAULT_TEMPLATE =
  'Hi {name}, your {gymName} membership expires on {endDate}. Renew now to keep training! 💪'

export function buildWhatsAppUrl(
  phone: string,
  message: string
): string {
  // Strip everything except digits and leading '+'
  const digits = phone.replace(/[^+\d]/g, '')
  const cleanPhone = digits.startsWith('+') ? digits.slice(1) : digits
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encoded}`
}

export function buildReminderMessage(
  name: string,
  gymName: string,
  endDate: string
): string {
  return DEFAULT_TEMPLATE
    .replace('{name}', name)
    .replace('{gymName}', gymName)
    .replace('{endDate}', endDate)
}

export function openWhatsApp(phone: string, message: string): void {
  const url = buildWhatsAppUrl(phone, message)
  window.open(url, '_blank')
}
