/**
 * WhatsApp deep-link utilities
 */

const DEFAULT_EXPIRING_TEMPLATE =
  'Hi {name}, your {gymName} membership plan is expiring on {endDate}. Renew now to keep training! 💪'

const DEFAULT_EXPIRED_TEMPLATE =
  'Hi {name}, your {gymName} membership plan has expired on {endDate}. Please renew to continue your fitness journey! 🏋️'

const STORAGE_KEY_EXPIRING = 'gym-app-template-expiring'
const STORAGE_KEY_EXPIRED = 'gym-app-template-expired'

export function getExpiringTemplate(): string {
  return localStorage.getItem(STORAGE_KEY_EXPIRING) || DEFAULT_EXPIRING_TEMPLATE
}

export function getExpiredTemplate(): string {
  return localStorage.getItem(STORAGE_KEY_EXPIRED) || DEFAULT_EXPIRED_TEMPLATE
}

export function setExpiringTemplate(template: string): void {
  localStorage.setItem(STORAGE_KEY_EXPIRING, template)
}

export function setExpiredTemplate(template: string): void {
  localStorage.setItem(STORAGE_KEY_EXPIRED, template)
}

export function getDefaultExpiringTemplate(): string {
  return DEFAULT_EXPIRING_TEMPLATE
}

export function getDefaultExpiredTemplate(): string {
  return DEFAULT_EXPIRED_TEMPLATE
}

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
  endDate: string,
  status: 'expiring_soon' | 'expired' = 'expiring_soon'
): string {
  const template = status === 'expired' ? getExpiredTemplate() : getExpiringTemplate()
  return template
    .replace('{name}', name)
    .replace('{gymName}', gymName)
    .replace('{endDate}', endDate)
}
