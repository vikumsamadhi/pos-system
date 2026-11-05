import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category, MovementReason, Product, Unit, UpdateProduct } from '@shared/types'
import { formatMoney, formatQty, qtyToMilli } from '@shared/money'
import { useI18n } from '../lib/i18n'

const UNITS: Unit[] = ['pcs', 'kg', 'g', 'l', 'ml', 'pack']

interface NewFormState {
  sku: string
  barcode: string
  name: string
  nameSi: string
  categoryId: string
  unit: Unit
  price: string
  cost: string
  openingStock: string
  reorderLevel: string
  isWeighed: boolean
}

const EMPTY_NEW_FORM: NewFormState = {
  sku: '',
  barcode: '',
  name: '',
  nameSi: '',
  categoryId: '',
  unit: 'pcs',
  price: '',
  cost: '',
  openingStock: '',
  reorderLevel: '',
  isWeighed: false,
}

interface EditFormState {
  id: number
  sku: string
  barcode: string
  name: string
  nameSi: string
  categoryId: string
  unit: Unit
  price: string
  cost: string
  reorderLevel: string
  isWeighed: boolean
  active: boolean
}

export default function ProductsPage() {
  const { t, productTitle } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [scanBarcodeInput, setScanBarcodeInput] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<NewFormState>(EMPTY_NEW_FORM)
  const [editingProduct, setEditingProduct] = useState<EditFormState | null>(null)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState<MovementReason>('purchase')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const REASONS: Array<{ value: MovementReason; label: string }> = [
    { value: 'purchase', label: t('reasonPurchase') },
    { value: 'adjustment', label: t('reasonAdjustment') },
    { value: 'return', label: t('reasonReturn') },
    { value: 'waste', label: t('reasonWaste') },
  ]

  async function refresh() {
    const [nextProducts, nextCategories] = await Promise.all([
      window.pos.listProducts(),
      window.pos.listCategories(),
    ])
    setProducts(nextProducts)
    setCategories(nextCategories)
  }

  useEffect(() => {
    refresh().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return products
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.nameSi ?? '').toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (product.barcode ?? '').includes(term),
    )
  }, [products, query])

  // Barcode input handler: scan to sell/update/add
  async function handleBarcodeScan(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    const code = scanBarcodeInput.trim()
    if (!code) return
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const match = await window.pos.findByBarcode(code)
      if (match) {
        // Product exists -> open Edit Modal to let user update details / price!
        openEditModal(match)
        setNotice(`Found product for barcode: ${code}. Update price or details below.`)
      } else {
        // New barcode -> prefill New Product Form with barcode!
        setAddForm({
          ...EMPTY_NEW_FORM,
          barcode: code,
          sku: `SKU-${code.slice(-6)}`,
        })
        setShowAddForm(true)
        setNotice(`New barcode scanned: ${code}. Enter details to add to catalog.`)
      }
      setScanBarcodeInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function openEditModal(p: Product) {
    setEditingProduct({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode ?? '',
      name: p.name,
      nameSi: p.nameSi ?? '',
      categoryId: p.categoryId ? String(p.categoryId) : '',
      unit: p.unit,
      price: (p.priceCents / 100).toFixed(2),
      cost: (p.costCents / 100).toFixed(2),
      reorderLevel: (p.reorderLevelMilli / 1000).toString(),
      isWeighed: p.isWeighed,
      active: p.active,
    })
    setShowAddForm(false)
  }

  async function submitAddProduct(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await window.pos.createProduct({
        sku: addForm.sku.trim(),
        barcode: addForm.barcode.trim() || null,
        name: addForm.name.trim(),
        nameSi: addForm.nameSi.trim() || null,
        categoryId: addForm.categoryId ? Number(addForm.categoryId) : null,
        unit: addForm.unit,
        priceCents: Math.round(Number.parseFloat(addForm.price || '0') * 100),
        costCents: Math.round(Number.parseFloat(addForm.cost || '0') * 100),
        isWeighed: addForm.isWeighed,
        reorderLevelMilli: qtyToMilli(Number.parseFloat(addForm.reorderLevel || '0')),
        openingStockMilli: qtyToMilli(Number.parseFloat(addForm.openingStock || '0')),
      })
      await refresh()
      setAddForm(EMPTY_NEW_FORM)
      setShowAddForm(false)
      setNotice(t('productAddedNotice'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitEditProduct(event: React.FormEvent) {
    event.preventDefault()
    if (!editingProduct) return
    setBusy(true)
    setError(null)
    try {
      const payload: UpdateProduct = {
        id: editingProduct.id,
        sku: editingProduct.sku.trim(),
        barcode: editingProduct.barcode.trim() || null,
        name: editingProduct.name.trim(),
        nameSi: editingProduct.nameSi.trim() || null,
        categoryId: editingProduct.categoryId ? Number(editingProduct.categoryId) : null,
        unit: editingProduct.unit,
        priceCents: Math.round(Number.parseFloat(editingProduct.price || '0') * 100),
        costCents: Math.round(Number.parseFloat(editingProduct.cost || '0') * 100),
        isWeighed: editingProduct.isWeighed,
        active: editingProduct.active,
        reorderLevelMilli: qtyToMilli(Number.parseFloat(editingProduct.reorderLevel || '0')),
      }
      await window.pos.updateProduct(payload)
      await refresh()
      setEditingProduct(null)
      setNotice(t('productUpdatedNotice'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitAdjust(event: React.FormEvent) {
    event.preventDefault()
    if (!adjusting) return
    const qty = Number.parseFloat(adjustQty)
    if (!Number.isFinite(qty) || qty === 0) {
      setError('Enter a non-zero stock change.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.pos.adjustStock({
        productId: adjusting.id,
        qtyChangeMilli: qtyToMilli(qty),
        reason: adjustReason,
      })
      await refresh()
      setAdjusting(null)
      setAdjustQty('')
      setNotice(`Stock updated for ${adjusting.name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">{t('productsAndStock')}</h1>
            <p className="text-xs text-slate-500">
              {products.length} {t('activeProductsSummary')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchProductPlaceholder')}
              className="field w-72"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowAddForm((prev) => !prev)
                setEditingProduct(null)
              }}
            >
              {showAddForm ? t('cancel') : t('newProduct')}
            </button>
          </div>
        </div>

        {/* Dedicated Barcode Scanner Bar for Inventory Input & Price Updating */}
        <div className="card flex items-center gap-3 border-counter-accent/30 bg-counter-900/90 p-3">
          <div className="flex items-center gap-2 text-counter-accent text-sm font-semibold whitespace-nowrap">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            {t('scanToInputOrUpdate')}:
          </div>
          <input
            ref={scanInputRef}
            value={scanBarcodeInput}
            onChange={(e) => setScanBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeScan}
            placeholder={t('scanBarcodePrompt')}
            className="field flex-1 font-mono text-base border-counter-accent/40 focus:border-counter-accent"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {notice}
          </div>
        )}

        {/* Add Product Form */}
        {showAddForm && (
          <form onSubmit={submitAddProduct} className="card p-4 border-counter-accent/40">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-counter-accent">
              {t('newProduct')}
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">{t('nameEnLabel')} *</label>
                <input
                  required
                  value={addForm.name}
                  onChange={(event) => setAddForm({ ...addForm, name: event.target.value })}
                  className="field"
                  placeholder="e.g. White Sugar 1kg"
                />
              </div>
              <div>
                <label className="label">{t('nameSiLabel')}</label>
                <input
                  value={addForm.nameSi}
                  onChange={(event) => setAddForm({ ...addForm, nameSi: event.target.value })}
                  className="field"
                  placeholder="???: ???? ???? 1kg"
                />
              </div>
              <div>
                <label className="label">{t('skuLabel')} *</label>
                <input
                  required
                  value={addForm.sku}
                  onChange={(event) => setAddForm({ ...addForm, sku: event.target.value })}
                  className="field font-mono"
                  placeholder="e.g. GRC-1002"
                />
              </div>
              <div>
                <label className="label">{t('barcodeLabel')}</label>
                <input
                  value={addForm.barcode}
                  onChange={(event) => setAddForm({ ...addForm, barcode: event.target.value })}
                  className="field font-mono"
                  placeholder="Scan or type barcode"
                />
              </div>
              <div>
                <label className="label">{t('categoryLabel')}</label>
                <select
                  value={addForm.categoryId}
                  onChange={(event) => setAddForm({ ...addForm, categoryId: event.target.value })}
                  className="field"
                >
                  <option value="">{t('uncategorised')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('unitLabel')}</label>
                <select
                  value={addForm.unit}
                  onChange={(event) => setAddForm({ ...addForm, unit: event.target.value as Unit })}
                  className="field"
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('sellingPriceLabel')} *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.price}
                  onChange={(event) => setAddForm({ ...addForm, price: event.target.value })}
                  className="field font-mono font-semibold text-counter-accent"
                  placeholder="240.00"
                />
              </div>
              <div>
                <label className="label">{t('costPriceLabel')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.cost}
                  onChange={(event) => setAddForm({ ...addForm, cost: event.target.value })}
                  className="field font-mono"
                  placeholder="215.00"
                />
              </div>
              <div>
                <label className="label">{t('openingStockLabel')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={addForm.openingStock}
                  onChange={(event) => setAddForm({ ...addForm, openingStock: event.target.value })}
                  className="field font-mono"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="label">{t('reorderLevelLabel')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={addForm.reorderLevel}
                  onChange={(event) => setAddForm({ ...addForm, reorderLevel: event.target.value })}
                  className="field font-mono"
                  placeholder="5"
                />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={addForm.isWeighed}
                onChange={(event) => setAddForm({ ...addForm, isWeighed: event.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-counter-950"
              />
              {t('soldByWeight')}
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowAddForm(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? t('saving') : t('addProduct')}
              </button>
            </div>
          </form>
        )}

        {/* Edit Product & Price Modal */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <form onSubmit={submitEditProduct} className="w-full max-w-2xl rounded-2xl border border-counter-accent/50 bg-counter-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h2 className="text-lg font-semibold text-white">{t('editProductTitle')}</h2>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ?
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">{t('nameEnLabel')} *</label>
                  <input
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="field font-medium"
                  />
                </div>
                <div>
                  <label className="label">{t('nameSiLabel')}</label>
                  <input
                    value={editingProduct.nameSi}
                    onChange={(e) => setEditingProduct({ ...editingProduct, nameSi: e.target.value })}
                    className="field"
                    placeholder="????? ??"
                  />
                </div>
                <div>
                  <label className="label text-counter-accent font-semibold">{t('sellingPriceLabel')} *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    className="field font-mono text-base font-bold text-counter-accent border-counter-accent/50"
                  />
                </div>
                <div>
                  <label className="label">{t('costPriceLabel')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.cost}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost: e.target.value })}
                    className="field font-mono"
                  />
                </div>
                <div>
                  <label className="label">{t('skuLabel')} *</label>
                  <input
                    required
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    className="field font-mono"
                  />
                </div>
                <div>
                  <label className="label">{t('barcodeLabel')}</label>
                  <input
                    value={editingProduct.barcode}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="field font-mono"
                    placeholder="Barcode"
                  />
                </div>
                <div>
                  <label className="label">{t('categoryLabel')}</label>
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                    className="field"
                  >
                    <option value="">{t('uncategorised')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('unitLabel')}</label>
                  <select
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value as Unit })}
                    className="field"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('reorderLevelLabel')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={editingProduct.reorderLevel}
                    onChange={(e) => setEditingProduct({ ...editingProduct, reorderLevel: e.target.value })}
                    className="field font-mono"
                  />
                </div>
                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingProduct.isWeighed}
                      onChange={(e) => setEditingProduct({ ...editingProduct, isWeighed: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-counter-950"
                    />
                    {t('soldByWeight')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingProduct.active}
                      onChange={(e) => setEditingProduct({ ...editingProduct, active: e.target.checked })}
                      className="h-4 w-4 rounded border-white/20 bg-counter-950"
                    />
                    {t('activeProductLabel')}
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
                <button type="button" className="btn-ghost" onClick={() => setEditingProduct(null)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary font-semibold" disabled={busy}>
                  {busy ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Product Catalog Table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">{t('productCol')}</th>
                <th className="px-4 py-3">{t('skuBarcodeCol')}</th>
                <th className="px-4 py-3">{t('categoryCol')}</th>
                <th className="px-4 py-3 text-right">{t('priceCol')}</th>
                <th className="px-4 py-3 text-right">{t('costCol')}</th>
                <th className="px-4 py-3 text-right">{t('stockCol')}</th>
                <th className="px-4 py-3 text-right">{t('actionCol')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const low = product.stockMilli <= product.reorderLevelMilli
                const title = productTitle(product)
                return (
                  <tr key={product.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{title.main}</div>
                      {title.secondary && (
                        <div className="text-xs text-slate-400 font-normal">{title.secondary}</div>
                      )}
                      {product.isWeighed && <div className="text-[11px] text-slate-500">{t('soldByWeight')}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      <div>{product.sku}</div>
                      <div className="text-slate-500">{product.barcode ?? '?'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{product.categoryName ?? '?'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-counter-accent">
                      {formatMoney(product.priceCents, 'Rs. ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                      {formatMoney(product.costCents, 'Rs. ')}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${low ? 'text-counter-warn font-semibold' : 'text-slate-200'}`}>
                      {formatQty(product.stockMilli, product.unit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs text-counter-accent hover:border-counter-accent/50"
                          onClick={() => openEditModal(product)}
                        >
                          {t('editProduct')}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs"
                          onClick={() => setAdjusting(product)}
                        >
                          {t('adjustStock')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {t('noProductsMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={submitAdjust} className="w-full max-w-md rounded-2xl border border-white/10 bg-counter-900 p-5">
            <h2 className="text-lg font-semibold text-white">{t('adjustStockTitle')}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {adjusting.name} {adjusting.nameSi ? `(${adjusting.nameSi})` : ''} ? {t('stockCol')}: {formatQty(adjusting.stockMilli, adjusting.unit)}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">{t('changeQtyLabel')} ({adjusting.unit})</label>
                <input
                  autoFocus
                  type="number"
                  step="0.001"
                  value={adjustQty}
                  onChange={(event) => setAdjustQty(event.target.value)}
                  className="field font-mono"
                  placeholder="e.g. 24 or -2"
                />
              </div>
              <div>
                <label className="label">{t('reasonLabel')}</label>
                <select
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value as MovementReason)}
                  className="field"
                >
                  {REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setAdjusting(null)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? t('saving') : t('applyStock')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
