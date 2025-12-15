// src/lib/fiscal/utils.ts

export function formatAmount(amount: number, decimals: number = 2): string {
  return amount.toFixed(decimals)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // Format: DD.MM.YYYYTHH:MM:SS
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${day}.${month}.${year}T${hours}:${minutes}:${seconds}`
}

export function generateUUID(): string {
  return crypto.randomUUID()
}
