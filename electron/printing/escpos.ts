import type { Receipt } from '@shared/types'
import { formatMoney, milliToQty } from '@shared/money'

const WIDTH = 48

const ESC = 0x1b
const GS = 0x1d

function text(value: string): Buffer {
  return Buffer.from(value, 'ascii')
}

function line(left: string, right: string, width = WIDTH): string {
  const space = Math.max(1, width - left.length - right.length)
  return `${left}${' '.repeat(space)}${right}`
}

function wrap(value: string, width = WIDTH): string[] {
  if (value.length <= width) return [value]
  const words = value.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width) {
      if (current) lines.push(current)
      current = word
    } else {
      current = `${current} ${word}`.trim()
    }
  }
  if (current) lines.push(current)
  return lines
}

function qtyText(qtyMilli: number): string {
  const qty = milliToQty(qtyMilli)
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * ESC/POS byte stream for an 80 mm thermal printer (48 columns, Font A).
 * ASCII-based stream for legacy/hardware serial/USB port writes.
 */
export function buildEscposReceipt(receipt: Receipt, options?: { openDrawer?: boolean }): Buffer {
  const chunks: Buffer[] = []

  const push = (value: string | Buffer) => {
    chunks.push(typeof value === 'string' ? text(value) : value)
  }
  const command = (bytes: number[]) => {
    chunks.push(Buffer.from(bytes))
  }

  command([ESC, 0x40]) // initialise
  command([ESC, 0x61, 0x01]) // centre

  command([ESC, 0x45, 0x01]) // bold on
  push(`${receipt.storeName}\n`)
  command([ESC, 0x45, 0x00]) // bold off

  if (receipt.storeAddress) push(`${receipt.storeAddress}\n`)
  if (receipt.storePhone) push(`Tel: ${receipt.storePhone}\n`)
  push('\n')

  command([ESC, 0x61, 0x00]) // left
  push(`${line('Receipt', receipt.receiptNo)}\n`)
  push(`${line(`Date: ${receipt.createdAt}`, `Cashier: ${receipt.cashierName}`)}\n`)
  push(`${'-'.repeat(WIDTH)}\n`)

  for (const item of receipt.lines) {
    const nameLines = wrap(item.name)
    push(`${nameLines[0]}\n`)
    for (const extra of nameLines.slice(1)) push(`  ${extra}\n`)
    const left = `  ${qtyText(item.qtyMilli)} x ${formatMoney(item.unitPriceCents, '')}`.trimEnd()
    push(`${line(left, formatMoney(item.lineTotalCents, ''))}\n`)
  }

  push(`${'-'.repeat(WIDTH)}\n`)
  push(`${line('Subtotal', formatMoney(receipt.totals.subtotalCents, ''))}\n`)
  if (receipt.totals.discountCents > 0) {
    push(`${line('Discount', `-${formatMoney(receipt.totals.discountCents, '')}`)}\n`)
  }
  if (receipt.totals.taxCents > 0) {
    push(`${line('Tax', formatMoney(receipt.totals.taxCents, ''))}\n`)
  }

  command([ESC, 0x45, 0x01])
  command([GS, 0x21, 0x11]) // double width + height
  push(`${line('TOTAL', formatMoney(receipt.totals.totalCents, ''), 24)}\n`)
  command([GS, 0x21, 0x00])
  command([ESC, 0x45, 0x00])

  push(`${line(receipt.paymentMethod === 'cash' ? 'Cash' : 'Card', formatMoney(receipt.tenderedCents, ''))}\n`)
  if (receipt.paymentMethod === 'cash') {
    push(`${line('Change', formatMoney(receipt.totals.changeCents, ''))}\n`)
  }

  push('\n')
  command([ESC, 0x61, 0x01])
  if (receipt.footer) {
    for (const footerLine of wrap(receipt.footer)) push(`${footerLine}\n`)
  }
  push('\n\n\n')

  if (options?.openDrawer !== false && receipt.paymentMethod === 'cash') {
    command([ESC, 0x70, 0x00, 0x19, 0xfa]) // drawer kick, pin 2
  }

  command([GS, 0x56, 0x00]) // full cut

  return Buffer.concat(chunks)
}

/**
 * 80 mm receipt as HTML with full Sinhala & English typography.
 * Supports Sinhala ('si'), English ('en'), or Bilingual ('both') formats.
 */
export function buildReceiptHtml(receipt: Receipt, lang: 'en' | 'si' | 'both' = 'si'): string {
  const isSi = lang === 'si'
  const isBoth = lang === 'both'

  const labels = {
    receipt: isSi ? '????? (Receipt)' : isBoth ? '????? / Receipt' : 'Receipt',
    date: isSi ? '????' : isBoth ? '???? / Date' : 'Date',
    cashier: isSi ? '??????' : isBoth ? '?????? / Cashier' : 'Cashier',
    subtotal: isSi ? '?? ?????' : isBoth ? '?? ????? / Subtotal' : 'Subtotal',
    discount: isSi ? '??????' : isBoth ? '?????? / Discount' : 'Discount',
    tax: isSi ? '???' : isBoth ? '??? / Tax' : 'Tax',
    total: isSi ? '???? ?????' : isBoth ? '???? ????? / TOTAL' : 'TOTAL',
    cash: isSi ? '?????' : isBoth ? '????? / Cash' : 'Cash',
    card: isSi ? '???????' : isBoth ? '??????? / Card' : 'Card',
    change: isSi ? '????? ????' : isBoth ? '????? ???? / Change' : 'Change',
    footer: isSi ? '????????! ???? ????.' : isBoth ? '????????! ???? ????. Thank you!' : 'Thank you for shopping with us!',
  }

  const rows = receipt.lines
    .map((item) => {
      let displayName = escapeHtml(item.name)
      if (isSi && item.nameSi) {
        displayName = `${escapeHtml(item.nameSi)} <span class="sub-name">(${escapeHtml(item.name)})</span>`
      } else if (isBoth && item.nameSi) {
        displayName = `${escapeHtml(item.nameSi)}<br/><span class="sub-name">${escapeHtml(item.name)}</span>`
      } else if (item.nameSi && !item.name) {
        displayName = escapeHtml(item.nameSi)
      }

      return `<tr>
        <td>
          <div class="item-name">${displayName}</div>
          <div class="q">${qtyText(item.qtyMilli)} ? ${formatMoney(item.unitPriceCents, 'Rs. ')}</div>
        </td>
        <td class="r">${formatMoney(item.lineTotalCents, '')}</td>
      </tr>`
    })
    .join('')

  const payLabel = receipt.paymentMethod === 'cash' ? labels.cash : labels.card

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(receipt.receiptNo)}</title>
<style>
  @page { size: 80mm auto; margin: 2mm 3mm; }
  * { box-sizing: border-box; }
  body {
    width: 72mm;
    margin: 0 auto;
    padding: 2mm 0;
    font-family: 'Iskoola Pota', 'Nirmala UI', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #000;
  }
  h1 { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 2px; }
  .muted { text-align: center; margin: 1px 0; font-size: 10px; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td { padding: 2px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .item-name { font-weight: 600; font-size: 11px; color: #000; word-break: break-word; }
  .sub-name { font-weight: 400; font-size: 9.5px; color: #444; }
  .q { color: #333; font-size: 10px; margin-top: 1px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; }
  .total-row td { font-size: 15px; font-weight: 800; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; }
  .foot { text-align: center; margin-top: 10px; font-size: 11px; font-weight: 600; }
</style>
</head>
<body>
  <h1>${escapeHtml(receipt.storeName)}</h1>
  ${receipt.storeAddress ? `<p class="muted">${escapeHtml(receipt.storeAddress)}</p>` : ''}
  ${receipt.storePhone ? `<p class="muted">Tel: ${escapeHtml(receipt.storePhone)}</p>` : ''}
  <hr>
  <div class="meta-row">
    <span>${labels.receipt}: <strong>${escapeHtml(receipt.receiptNo)}</strong></span>
  </div>
  <div class="meta-row">
    <span>${labels.date}: ${escapeHtml(receipt.createdAt)}</span>
    <span>${labels.cashier}: ${escapeHtml(receipt.cashierName)}</span>
  </div>
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    <tr><td>${labels.subtotal}</td><td class="r">${formatMoney(receipt.totals.subtotalCents, '')}</td></tr>
    ${receipt.totals.discountCents > 0 ? `<tr><td>${labels.discount}</td><td class="r">-${formatMoney(receipt.totals.discountCents, '')}</td></tr>` : ''}
    ${receipt.totals.taxCents > 0 ? `<tr><td>${labels.tax}</td><td class="r">${formatMoney(receipt.totals.taxCents, '')}</td></tr>` : ''}
    <tr class="total-row"><td>${labels.total}</td><td class="r">${formatMoney(receipt.totals.totalCents, 'Rs. ')}</td></tr>
    <tr><td>${payLabel}</td><td class="r">${formatMoney(receipt.tenderedCents, '')}</td></tr>
    ${receipt.paymentMethod === 'cash' ? `<tr><td>${labels.change}</td><td class="r">${formatMoney(receipt.totals.changeCents, '')}</td></tr>` : ''}
  </table>
  <p class="foot">${escapeHtml(receipt.footer || labels.footer)}</p>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
