import { createHash } from 'node:crypto'
import type { Db } from './database'

function hashPin(pin: string): string {
  return createHash('sha256').update(`pos:${pin}`).digest('hex')
}

interface SeedProduct {
  sku: string
  barcode: string
  name: string
  nameSi: string
  category: string
  unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml' | 'pack'
  priceCents: number
  costCents: number
  stockMilli: number
  reorderLevelMilli?: number
  weighed?: boolean
}

const CATEGORIES = ['Groceries', 'Beverages', 'Bakery', 'Snacks', 'Household', 'Fresh Produce']

const PRODUCTS: SeedProduct[] = [
  { sku: 'GRC-1001', barcode: '4791001000011', name: 'Nadu Rice 1kg', nameSi: '???? ???? 1kg', category: 'Groceries', unit: 'pcs', priceCents: 22000, costCents: 19000, stockMilli: 40000, reorderLevelMilli: 10000 },
  { sku: 'GRC-1002', barcode: '4791001000028', name: 'White Sugar 1kg', nameSi: '???? ???? 1kg', category: 'Groceries', unit: 'pcs', priceCents: 24000, costCents: 21500, stockMilli: 35000, reorderLevelMilli: 10000 },
  { sku: 'GRC-1003', barcode: '4791001000035', name: 'Red Dhal 500g', nameSi: '??? ??????? 500g', category: 'Groceries', unit: 'pcs', priceCents: 19500, costCents: 17000, stockMilli: 40000, reorderLevelMilli: 8000 },
  { sku: 'GRC-1004', barcode: '4791001000042', name: 'Coconut Oil 750ml', nameSi: '???? ???? 750ml', category: 'Groceries', unit: 'pcs', priceCents: 62000, costCents: 56000, stockMilli: 24000, reorderLevelMilli: 6000 },
  { sku: 'GRC-1005', barcode: '4791001000059', name: 'Brown Eggs (10)', nameSi: '?????? ?????? (10)', category: 'Fresh Produce', unit: 'pack', priceCents: 49000, costCents: 44000, stockMilli: 18000, reorderLevelMilli: 6000 },
  { sku: 'GRC-1006', barcode: '4791001000066', name: 'Milk Powder 400g', nameSi: '???? ???? 400g', category: 'Groceries', unit: 'pcs', priceCents: 125000, costCents: 114000, stockMilli: 30000, reorderLevelMilli: 8000 },
  { sku: 'GRC-1007', barcode: '4791001000073', name: 'Tea Dust 400g', nameSi: '?? ???? 400g', category: 'Beverages', unit: 'pcs', priceCents: 78000, costCents: 71000, stockMilli: 26000, reorderLevelMilli: 6000 },
  { sku: 'GRC-1008', barcode: '4791001000080', name: 'Iodised Salt 1kg', nameSi: '?????? ???? 1kg', category: 'Groceries', unit: 'pcs', priceCents: 8500, costCents: 7000, stockMilli: 50000, reorderLevelMilli: 10000 },
  { sku: 'GRC-1009', barcode: '4791001000097', name: 'Wheat Flour 1kg', nameSi: '?????? ???? 1kg', category: 'Groceries', unit: 'pcs', priceCents: 16500, costCents: 14500, stockMilli: 44000, reorderLevelMilli: 10000 },
  { sku: 'BAK-2001', barcode: '4791002000010', name: 'Sandwich Bread 450g', nameSi: '?????????? ???? 450g', category: 'Bakery', unit: 'pcs', priceCents: 15000, costCents: 12500, stockMilli: 12000, reorderLevelMilli: 6000 },
  { sku: 'BEV-3001', barcode: '4791003000019', name: 'Cola 1.5L', nameSi: '???? 1.5L', category: 'Beverages', unit: 'pcs', priceCents: 38000, costCents: 33000, stockMilli: 20000, reorderLevelMilli: 6000 },
  { sku: 'BEV-3002', barcode: '4791003000026', name: 'Bottled Water 1L', nameSi: '????? ?? ????? 1L', category: 'Beverages', unit: 'pcs', priceCents: 12000, costCents: 8500, stockMilli: 60000, reorderLevelMilli: 12000 },
  { sku: 'SNC-4001', barcode: '4791004000018', name: 'Marie Biscuits 200g', nameSi: '???? ??????? 200g', category: 'Snacks', unit: 'pcs', priceCents: 15000, costCents: 12500, stockMilli: 48000, reorderLevelMilli: 12000 },
  { sku: 'SNC-4002', barcode: '4791004000025', name: 'Potato Chips 100g', nameSi: '?? ?????? 100g', category: 'Snacks', unit: 'pcs', priceCents: 22000, costCents: 18000, stockMilli: 36000, reorderLevelMilli: 10000 },
  { sku: 'HHD-5001', barcode: '4791005000017', name: 'Detergent Powder 1kg', nameSi: '???? ???? ???? 1kg', category: 'Household', unit: 'pcs', priceCents: 95000, costCents: 86000, stockMilli: 15000, reorderLevelMilli: 4000 },
  { sku: 'HHD-5002', barcode: '4791005000024', name: 'Soap Bar 100g', nameSi: '???? ???? 100g', category: 'Household', unit: 'pcs', priceCents: 9500, costCents: 7500, stockMilli: 40000, reorderLevelMilli: 10000 },
  { sku: 'FRS-6001', barcode: '4791006000016', name: 'Tomatoes (loose)', nameSi: '??????? (????)', category: 'Fresh Produce', unit: 'kg', priceCents: 18000, costCents: 14000, stockMilli: 12000, reorderLevelMilli: 3000, weighed: true },
  { sku: 'FRS-6002', barcode: '4791006000023', name: 'Carrots (loose)', nameSi: '????? (????)', category: 'Fresh Produce', unit: 'kg', priceCents: 16000, costCents: 12000, stockMilli: 10000, reorderLevelMilli: 3000, weighed: true },
]

export function seedIfEmpty(db: Db): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }
  if (count.n > 0) return

  const insertCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)')
  const insertProduct = db.prepare(
    `INSERT INTO products
      (sku, barcode, name, name_si, category_id, unit, price_cents, cost_cents, tax_rate_bp, is_weighed, reorder_level_milli)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  )
  const insertMovement = db.prepare(
    `INSERT INTO inventory_movements (product_id, qty_change_milli, reason, note)
     VALUES (?, ?, 'opening', 'Seed opening stock')`,
  )

  const settings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  const defaults: Array<[string, string]> = [
    ['store_name', 'Vikum Store'],
    ['store_name_si', '???????? ???????'],
    ['store_address', 'No. 1, Main Street, Colombo'],
    ['store_address_si', '??. 1, ??????? ?????, ????'],
    ['store_phone', '+94 77 000 0000'],
    ['currency', 'LKR'],
    ['receipt_footer', 'Thank you for shopping with us!'],
    ['receipt_footer_si', '?? ??? ??????? ?? ??? ????????!'],
    ['receipt_width_mm', '80'],
    ['tax_inclusive', '0'],
    ['printer_name', ''],
    ['printer_connection', 'usb'],
  ]
  for (const [key, value] of defaults) settings.run(key, value)

  const counters = db.prepare('INSERT OR IGNORE INTO counters (name, value) VALUES (?, ?)')
  counters.run('receipt', 0)

  const users = db.prepare('INSERT OR IGNORE INTO users (name, role, pin_hash) VALUES (?, ?, ?)')
  users.run('Manager', 'manager', hashPin('1234'))
  users.run('Cashier', 'cashier', hashPin('0000'))

  const tx = db.transaction(() => {
    const categoryIds = new Map<string, number>()
    CATEGORIES.forEach((name, index) => {
      const info = insertCategory.run(name, index)
      categoryIds.set(name, Number(info.lastInsertRowid))
    })

    for (const product of PRODUCTS) {
      const info = insertProduct.run(
        product.sku,
        product.barcode,
        product.name,
        product.nameSi,
        categoryIds.get(product.category) ?? null,
        product.unit,
        product.priceCents,
        product.costCents,
        product.weighed ? 1 : 0,
        product.reorderLevelMilli ?? 0,
      )
      insertMovement.run(Number(info.lastInsertRowid), product.stockMilli)
    }

    db.prepare("INSERT INTO audit_log (action, entity, detail) VALUES ('seed', 'database', 'Initial catalog created')").run()
  })

  tx()
}

export function updateSeedSinhalaNames(db: Db): void {
  const updateStmt = db.prepare("UPDATE products SET name_si = ? WHERE sku = ? AND (name_si IS NULL OR name_si = '')")
  const tx = db.transaction(() => {
    for (const p of PRODUCTS) {
      updateStmt.run(p.nameSi, p.sku)
    }
  })
  tx()
}
