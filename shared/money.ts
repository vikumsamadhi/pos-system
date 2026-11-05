export const QTY_SCALE = 1000

export function qtyToMilli(qty: number): number {
  return Math.round(qty * QTY_SCALE)
}

export function milliToQty(milli: number): number {
  return milli / QTY_SCALE
}

export function formatMoney(cents: number, currency = 'LKR'): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}${currency} ${whole.toLocaleString('en-US')}.${frac}`
}

export function formatQty(milli: number, unit: string): string {
  const qty = milliToQty(milli)
  const text = Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${text} ${unit}`
}

export function lineSubtotalCents(qtyMilli: number, unitPriceCents: number): number {
  return Math.round((qtyMilli * unitPriceCents) / QTY_SCALE)
}

export function taxFromNet(netCents: number, taxRateBp: number): number {
  return Math.round((netCents * taxRateBp) / 10000)
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
