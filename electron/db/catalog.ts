import type { Category, NewProduct, Product, Unit, UpdateProduct } from '@shared/types'
import type { Db } from './database'

interface ProductRow {
  id: number
  sku: string
  barcode: string | null
  name: string
  name_si: string | null
  category_id: number | null
  category_name: string | null
  unit: string
  price_cents: number
  cost_cents: number
  tax_rate_bp: number
  is_weighed: number
  active: number
  reorder_level_milli: number
  stock_milli: number
}

const SELECT_PRODUCT = `
  SELECT p.id, p.sku, p.barcode, p.name, p.name_si, p.category_id, c.name AS category_name,
         p.unit, p.price_cents, p.cost_cents, p.tax_rate_bp, p.is_weighed,
         p.active, p.reorder_level_milli, COALESCE(s.stock_milli, 0) AS stock_milli
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_stock s ON s.product_id = p.id
`

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    nameSi: row.name_si,
    categoryId: row.category_id,
    categoryName: row.category_name,
    unit: row.unit as Unit,
    priceCents: row.price_cents,
    costCents: row.cost_cents,
    taxRateBp: row.tax_rate_bp,
    isWeighed: row.is_weighed === 1,
    active: row.active === 1,
    reorderLevelMilli: row.reorder_level_milli,
    stockMilli: row.stock_milli,
  }
}

export function listProducts(db: Db, query?: string): Product[] {
  const term = query?.trim()
  if (term) {
    const like = `%${term}%`
    const rows = db
      .prepare(
        `${SELECT_PRODUCT}
         WHERE p.active = 1 AND (p.name LIKE ? OR p.name_si LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)
         ORDER BY p.name LIMIT 200`,
      )
      .all(like, like, like, like) as ProductRow[]
    return rows.map(toProduct)
  }
  const rows = db
    .prepare(`${SELECT_PRODUCT} WHERE p.active = 1 ORDER BY p.name LIMIT 500`)
    .all() as ProductRow[]
  return rows.map(toProduct)
}

export function findByBarcode(db: Db, barcode: string): Product | null {
  const row = db
    .prepare(`${SELECT_PRODUCT} WHERE p.barcode = ? AND p.active = 1`)
    .get(barcode.trim()) as ProductRow | undefined
  return row ? toProduct(row) : null
}

export function getProduct(db: Db, productId: number): Product | null {
  const row = db.prepare(`${SELECT_PRODUCT} WHERE p.id = ?`).get(productId) as ProductRow | undefined
  return row ? toProduct(row) : null
}

export function listCategories(db: Db): Category[] {
  return db
    .prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order, name')
    .all()
    .map((row) => {
      const r = row as { id: number; name: string; sort_order: number }
      return { id: r.id, name: r.name, sortOrder: r.sort_order }
    })
}

export function createProduct(db: Db, product: NewProduct): Product {
  const insert = db.prepare(
    `INSERT INTO products
       (sku, barcode, name, name_si, category_id, unit, price_cents, cost_cents, tax_rate_bp, is_weighed, reorder_level_milli)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const movement = db.prepare(
    `INSERT INTO inventory_movements (product_id, qty_change_milli, reason, note)
     VALUES (?, ?, 'opening', 'Product created')`,
  )

  const created = db.transaction(() => {
    const info = insert.run(
      product.sku,
      product.barcode?.trim() || null,
      product.name,
      product.nameSi?.trim() || null,
      product.categoryId ?? null,
      product.unit,
      product.priceCents,
      product.costCents ?? 0,
      product.taxRateBp ?? 0,
      product.isWeighed ? 1 : 0,
      product.reorderLevelMilli ?? 0,
    )
    const id = Number(info.lastInsertRowid)
    if (product.openingStockMilli && product.openingStockMilli !== 0) {
      movement.run(id, product.openingStockMilli)
    }
    db.prepare(`INSERT INTO audit_log (action, entity, entity_id, detail) VALUES ('create', 'product', ?, ?)`).run(
      id,
      product.name,
    )
    return id
  })()

  const result = getProduct(db, created)
  if (!result) throw new Error('Product was created but could not be read back')
  return result
}

export function updateProduct(db: Db, product: UpdateProduct): Product {
  const update = db.prepare(
    `UPDATE products
     SET sku = ?, barcode = ?, name = ?, name_si = ?, category_id = ?, unit = ?,
         price_cents = ?, cost_cents = ?, tax_rate_bp = ?, is_weighed = ?,
         active = ?, reorder_level_milli = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
  )

  db.transaction(() => {
    update.run(
      product.sku.trim(),
      product.barcode?.trim() || null,
      product.name.trim(),
      product.nameSi?.trim() || null,
      product.categoryId ?? null,
      product.unit,
      product.priceCents,
      product.costCents ?? 0,
      product.taxRateBp ?? 0,
      product.isWeighed ? 1 : 0,
      product.active !== false ? 1 : 0,
      product.reorderLevelMilli ?? 0,
      product.id,
    )
    db.prepare(`INSERT INTO audit_log (action, entity, entity_id, detail) VALUES ('update', 'product', ?, ?)`).run(
      product.id,
      `Updated ${product.name} (price=${product.priceCents})`,
    )
  })()

  const result = getProduct(db, product.id)
  if (!result) throw new Error(`Product ${product.id} not found after update`)
  return result
}

export function adjustStock(
  db: Db,
  input: { productId: number; qtyChangeMilli: number; reason: string; note?: string | null },
): Product {
  db.transaction(() => {
    db.prepare(
      `INSERT INTO inventory_movements (product_id, qty_change_milli, reason, note)
       VALUES (?, ?, ?, ?)`,
    ).run(input.productId, input.qtyChangeMilli, input.reason, input.note ?? null)
    db.prepare(`INSERT INTO audit_log (action, entity, entity_id, detail) VALUES ('adjust', 'product', ?, ?)`).run(
      input.productId,
      `${input.reason}: ${input.qtyChangeMilli}`,
    )
  })()

  const product = getProduct(db, input.productId)
  if (!product) throw new Error(`Product ${input.productId} not found`)
  return product
}
