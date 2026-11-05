import type {
  CheckoutInput,
  CheckoutResult,
  PaymentMethod,
  Receipt,
  ReceiptLine,
  SaleTotals,
} from '@shared/types'
import { lineSubtotalCents, todayIso } from '@shared/money'
import type { Db } from './database'
import { buildEscposReceipt } from '../printing/escpos'
import { getProduct } from './catalog'

interface ProductSnapshot {
  id: number
  name: string
  nameSi: string | null
  barcode: string | null
  unit: string
  taxRateBp: number
}

function readSettings(db: Db): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

function readReceipt(db: Db, saleId: number): Receipt {
  const sale = db
    .prepare(
      `SELECT s.id, s.receipt_no, s.created_at, s.subtotal_cents, s.discount_cents,
              s.tax_cents, s.total_cents, COALESCE(u.name, 'Cashier') AS cashier_name
       FROM sales s LEFT JOIN users u ON u.id = s.cashier_id
       WHERE s.id = ?`,
    )
    .get(saleId) as
    | {
        id: number
        receipt_no: string
        created_at: string
        subtotal_cents: number
        discount_cents: number
        tax_cents: number
        total_cents: number
        cashier_name: string
      }
    | undefined

  if (!sale) throw new Error(`Sale ${saleId} not found`)

  const items = db
    .prepare(
      `SELECT name_snapshot, name_si_snapshot, qty_milli, unit_price_cents, line_total_cents
       FROM sale_items WHERE sale_id = ? ORDER BY id`,
    )
    .all(saleId) as Array<{
    name_snapshot: string
    name_si_snapshot: string | null
    qty_milli: number
    unit_price_cents: number
    line_total_cents: number
  }>

  const payment = db
    .prepare('SELECT method, amount_cents, tendered_cents, change_cents FROM payments WHERE sale_id = ?')
    .get(saleId) as
    | { method: PaymentMethod; amount_cents: number; tendered_cents: number; change_cents: number }
    | undefined

  const settings = readSettings(db)
  const lines: ReceiptLine[] = items.map((item) => ({
    name: item.name_snapshot,
    nameSi: item.name_si_snapshot,
    qtyMilli: item.qty_milli,
    unitPriceCents: item.unit_price_cents,
    lineTotalCents: item.line_total_cents,
  }))

  const totals: SaleTotals = {
    subtotalCents: sale.subtotal_cents,
    discountCents: sale.discount_cents,
    taxCents: sale.tax_cents,
    totalCents: sale.total_cents,
    changeCents: payment?.change_cents ?? 0,
  }

  return {
    saleId: sale.id,
    receiptNo: sale.receipt_no,
    createdAt: sale.created_at,
    storeName: settings.store_name ?? 'Store',
    storeAddress: settings.store_address ?? '',
    storePhone: settings.store_phone ?? '',
    cashierName: sale.cashier_name,
    lines,
    totals,
    paymentMethod: payment?.method ?? 'cash',
    tenderedCents: payment?.tendered_cents ?? 0,
    footer: settings.receipt_footer ?? '',
  }
}

export function checkout(db: Db, input: CheckoutInput): CheckoutResult {
  if (!input.lines || input.lines.length === 0) {
    throw new Error('Cart is empty')
  }
  if (input.lines.some((line) => !Number.isFinite(line.qtyMilli) || line.qtyMilli <= 0)) {
    throw new Error('Every cart line needs a quantity greater than zero')
  }

  const runCheckout = db.transaction((payload: CheckoutInput) => {
    const snapshots = new Map<number, ProductSnapshot>()
    for (const line of payload.lines) {
      if (snapshots.has(line.productId)) continue
      const product = getProduct(db, line.productId)
      if (!product || !product.active) {
        throw new Error(`Product ${line.productId} is not available`)
      }
      snapshots.set(line.productId, {
        id: product.id,
        name: product.name,
        nameSi: product.nameSi ?? null,
        barcode: product.barcode,
        unit: product.unit,
        taxRateBp: product.taxRateBp,
      })
    }

    let grossSubtotal = 0
    let lineDiscountTotal = 0
    const prepared = payload.lines.map((line) => {
      const snapshot = snapshots.get(line.productId)
      if (!snapshot) throw new Error(`Product ${line.productId} is not available`)
      const subtotal = lineSubtotalCents(line.qtyMilli, line.unitPriceCents)
      const lineDiscount = Math.min(Math.max(0, line.discountCents), subtotal)
      grossSubtotal += subtotal
      lineDiscountTotal += lineDiscount
      return { line, snapshot, subtotal, lineDiscount, net: subtotal - lineDiscount }
    })

    const maxOrderDiscount = prepared.reduce((sum, item) => sum + item.net, 0)
    const orderDiscount = Math.min(Math.max(0, payload.discountCents), maxOrderDiscount)
    const totalDiscount = lineDiscountTotal + orderDiscount

    const netAfterLineDiscount = prepared.reduce((sum, item) => sum + item.net, 0)
    let allocated = 0
    const taxParts = prepared.map((item, index) => {
      const share =
        index === prepared.length - 1
          ? orderDiscount - allocated
          : Math.round((orderDiscount * item.net) / Math.max(1, netAfterLineDiscount))
      allocated += share
      const net = Math.max(0, item.net - share)
      return { net, tax: Math.round((net * item.snapshot.taxRateBp) / 10000) }
    })

    const taxCents = taxParts.reduce((sum, part) => sum + part.tax, 0)
    const totalCents = Math.max(0, grossSubtotal - totalDiscount + taxCents)

    const tendered = Math.round(payload.payment.tenderedCents)
    if (payload.payment.method === 'cash' && tendered < totalCents) {
      throw new Error('Cash tendered is less than the total')
    }
    const appliedTendered = payload.payment.method === 'cash' ? tendered : totalCents
    const change = payload.payment.method === 'cash' ? appliedTendered - totalCents : 0

    const businessDate = todayIso()
    const counter = db
      .prepare("UPDATE counters SET value = value + 1 WHERE name = 'receipt' RETURNING value")
      .get() as { value: number }
    const receiptNo = `INV-${String(counter.value).padStart(6, '0')}`

    const saleInfo = db
      .prepare(
        `INSERT INTO sales
           (receipt_no, business_date, subtotal_cents, discount_cents, tax_cents, total_cents, status, cashier_id, note)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      )
      .run(
        receiptNo,
        businessDate,
        grossSubtotal,
        totalDiscount,
        taxCents,
        totalCents,
        payload.cashierId ?? null,
        payload.note ?? null,
      )
    const saleId = Number(saleInfo.lastInsertRowid)

    const insertItem = db.prepare(
      `INSERT INTO sale_items
         (sale_id, product_id, name_snapshot, name_si_snapshot, barcode_snapshot, unit_snapshot,
          qty_milli, unit_price_cents, discount_cents, tax_rate_bp, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertMovement = db.prepare(
      `INSERT INTO inventory_movements (product_id, qty_change_milli, reason, sale_id, created_by)
       VALUES (?, ?, 'sale', ?, ?)`,
    )

    for (const item of prepared) {
      insertItem.run(
        saleId,
        item.line.productId,
        item.snapshot.name,
        item.snapshot.nameSi,
        item.snapshot.barcode,
        item.snapshot.unit,
        item.line.qtyMilli,
        item.line.unitPriceCents,
        item.lineDiscount,
        item.snapshot.taxRateBp,
        item.net,
      )
      insertMovement.run(item.line.productId, -item.line.qtyMilli, saleId, payload.cashierId ?? null)
    }

    db.prepare(
      `INSERT INTO payments (sale_id, method, amount_cents, tendered_cents, change_cents)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(saleId, payload.payment.method, totalCents, appliedTendered, change)

    db.prepare(`INSERT INTO audit_log (action, entity, entity_id, detail) VALUES ('checkout', 'sale', ?, ?)`).run(
      saleId,
      `${receiptNo} total=${totalCents}`,
    )

    return saleId
  })

  const saleId = runCheckout(input)
  const receipt = readReceipt(db, saleId)
  return {
    receipt,
    escposBase64: buildEscposReceipt(receipt).toString('base64'),
  }
}

export function getReceipt(db: Db, saleId: number): Receipt {
  return readReceipt(db, saleId)
}

export function dailySummary(db: Db, businessDate?: string) {
  const date = businessDate && businessDate.length > 0 ? businessDate : todayIso()

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS sale_count,
              COALESCE(SUM(subtotal_cents), 0) AS gross,
              COALESCE(SUM(discount_cents), 0) AS discount,
              COALESCE(SUM(tax_cents), 0) AS tax,
              COALESCE(SUM(total_cents), 0) AS net
       FROM sales WHERE business_date = ? AND status = 'completed'`,
    )
    .get(date) as { sale_count: number; gross: number; discount: number; tax: number; net: number }

  const payments = db
    .prepare(
      `SELECT p.method, COALESCE(SUM(p.amount_cents), 0) AS amount
       FROM payments p JOIN sales s ON s.id = p.sale_id
       WHERE s.business_date = ? AND s.status = 'completed'
       GROUP BY p.method`,
    )
    .all(date) as Array<{ method: string; amount: number }>

  const items = db
    .prepare(
      `SELECT COALESCE(SUM(si.qty_milli), 0) AS qty
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.business_date = ? AND s.status = 'completed'`,
    )
    .get(date) as { qty: number }

  const topItems = db
    .prepare(
      `SELECT si.name_snapshot AS name,
              SUM(si.qty_milli) AS qty_milli,
              SUM(si.line_total_cents) AS revenue_cents
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.business_date = ? AND s.status = 'completed'
       GROUP BY si.name_snapshot
       ORDER BY revenue_cents DESC
       LIMIT 5`,
    )
    .all(date) as Array<{ name: string; qty_milli: number; revenue_cents: number }>

  const cash = payments.find((row) => row.method === 'cash')?.amount ?? 0
  const card = payments.find((row) => row.method === 'card')?.amount ?? 0

  return {
    businessDate: date,
    saleCount: totals.sale_count,
    grossCents: totals.gross,
    discountCents: totals.discount,
    taxCents: totals.tax,
    netCents: totals.net,
    cashCents: cash,
    cardCents: card,
    itemsSoldMilli: items.qty,
    topItems: topItems.map((row) => ({
      name: row.name,
      qtyMilli: row.qty_milli,
      revenueCents: row.revenue_cents,
    })),
  }
}
