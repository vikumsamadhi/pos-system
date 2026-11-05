import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CheckoutResult, PaymentMethod, Product } from '@shared/types'
import { formatMoney, formatQty, lineSubtotalCents, qtyToMilli } from '@shared/money'
import ReceiptDialog from '../components/ReceiptDialog'
import { useI18n } from '../lib/i18n'

interface CartLine {
  key: string
  product: Product
  qtyMilli: number
  unitPriceCents: number
  discountCents: number
}

const QUICK_CASH = [50000, 100000, 200000, 500000, 1000000]

function cartKey(productId: number): string {
  return `p-${productId}`
}

export default function CheckoutPage() {
  const { t, productTitle } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [barcode, setBarcode] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CheckoutResult | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.pos
      .listProducts()
      .then(setProducts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products.slice(0, 60)
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          (product.nameSi ?? '').toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term) ||
          (product.barcode ?? '').includes(term),
      )
      .slice(0, 60)
  }, [products, search])

  const subtotalCents = cart.reduce(
    (sum, line) => sum + lineSubtotalCents(line.qtyMilli, line.unitPriceCents) - line.discountCents,
    0,
  )
  const taxCents = cart.reduce((sum, line) => {
    const net = lineSubtotalCents(line.qtyMilli, line.unitPriceCents) - line.discountCents
    return sum + Math.round((net * line.product.taxRateBp) / 10000)
  }, 0)
  const totalCents = subtotalCents + taxCents
  const tenderedCents = Math.round(Number.parseFloat(tendered || '0') * 100)
  const changeCents = method === 'cash' ? Math.max(0, tenderedCents - totalCents) : 0

  const addProduct = useCallback((product: Product, qtyMilli = qtyToMilli(1)) => {
    setScanError(null)
    setCart((current) => {
      const key = cartKey(product.id)
      const existing = current.find((line) => line.key === key)
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, qtyMilli: line.qtyMilli + qtyMilli } : line,
        )
      }
      return [
        ...current,
        {
          key,
          product,
          qtyMilli,
          unitPriceCents: product.priceCents,
          discountCents: 0,
        },
      ]
    })
    barcodeRef.current?.focus()
  }, [])

  async function handleScan(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    const code = barcode.trim()
    if (!code) return
    event.preventDefault()
    try {
      const product = await window.pos.findByBarcode(code)
      if (!product) {
        setScanError(`No product found for barcode: ${code}`)
        setBarcode('')
        return
      }
      addProduct(product)
      setBarcode('')
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    }
  }

  function setQty(key: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) return
    setCart((current) =>
      current.map((line) => (line.key === key ? { ...line, qtyMilli: Math.round(value * 1000) } : line)),
    )
  }

  function removeLine(key: string) {
    setCart((current) => current.filter((line) => line.key !== key))
  }

  async function completeSale() {
    if (cart.length === 0 || busy) return
    if (method === 'cash' && tenderedCents < totalCents) {
      setError(t('insufficientCash'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const checkoutResult = await window.pos.checkout({
        lines: cart.map((line) => ({
          productId: line.product.id,
          qtyMilli: line.qtyMilli,
          unitPriceCents: line.unitPriceCents,
          discountCents: line.discountCents,
          taxRateBp: line.product.taxRateBp,
        })),
        payment: {
          method,
          tenderedCents: method === 'cash' ? tenderedCents : totalCents,
        },
        discountCents: 0,
        cashierId: 1,
      })
      setResult(checkoutResult)
      setCart([])
      setTendered('')
      setProducts(await window.pos.listProducts())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_430px]">
      <section className="flex min-h-0 flex-col gap-3">
        <div className="card flex items-center gap-3 p-3">
          <div className="flex-1">
            <input
              ref={barcodeRef}
              autoFocus
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              onKeyDown={handleScan}
              placeholder={t('scanBarcodePlaceholder')}
              className="field font-mono text-base border-counter-accent/30 focus:border-counter-accent"
            />
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchProducts')}
            className="field w-64"
          />
        </div>

        {scanError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {scanError}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => {
              const title = productTitle(product)
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="card group p-3 text-left transition-colors hover:border-counter-accent/40 hover:bg-counter-800"
                >
                  <div className="line-clamp-2 text-sm font-semibold text-slate-100">
                    {title.main}
                  </div>
                  {title.secondary && (
                    <div className="truncate text-xs text-slate-400 font-normal mt-0.5">
                      {title.secondary}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                    {product.sku} ? {product.unit}
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <span className="font-mono text-base font-semibold text-counter-accent">
                      {formatMoney(product.priceCents)}
                    </span>
                    <span
                      className={`text-[11px] ${
                        product.stockMilli <= product.reorderLevelMilli ? 'text-counter-warn font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {formatQty(product.stockMilli, product.unit)}
                    </span>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full p-8 text-center text-sm text-slate-500">
                {t('noProductsMatch')}
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="card flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            {t('currentSale')}
          </h2>
          <span className="text-xs text-slate-500">
            {cart.length} {t('linesCount')}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {cart.length === 0 && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
              {t('scanToStart')}
            </div>
          )}
          {cart.map((line) => {
            const title = productTitle(line.product)
            return (
              <div key={line.key} className="rounded-lg px-2 py-2 hover:bg-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-100">{title.main}</div>
                    {title.secondary && (
                      <div className="truncate text-xs text-slate-400">{title.secondary}</div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      {formatMoney(line.unitPriceCents)} / {line.product.unit}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                  >
                    {t('remove')}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="h-7 w-7 rounded bg-white/5 text-slate-300 hover:bg-white/10"
                      onClick={() =>
                        setQty(line.key, Math.max(0.001, line.qtyMilli / 1000 - (line.product.isWeighed ? 0.1 : 1)))
                      }
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0.001"
                      step={line.product.isWeighed ? '0.001' : '1'}
                      value={line.qtyMilli / 1000}
                      onChange={(event) => setQty(line.key, Number.parseFloat(event.target.value))}
                      className="w-20 rounded border border-white/10 bg-counter-950 px-2 py-1 text-center font-mono text-sm"
                    />
                    <button
                      type="button"
                      className="h-7 w-7 rounded bg-white/5 text-slate-300 hover:bg-white/10"
                      onClick={() => setQty(line.key, line.qtyMilli / 1000 + (line.product.isWeighed ? 0.1 : 1))}
                    >
                      +
                    </button>
                  </div>
                  <div className="font-mono text-sm text-slate-200">
                    {formatMoney(lineSubtotalCents(line.qtyMilli, line.unitPriceCents) - line.discountCents)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-white/5 px-4 py-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>{t('subtotal')}</span>
              <span className="font-mono">{formatMoney(subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{t('tax')}</span>
              <span className="font-mono">{formatMoney(taxCents)}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs uppercase tracking-widest text-slate-400">{t('total')}</span>
              <span className="font-mono text-2xl font-semibold text-white">{formatMoney(totalCents)}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod('cash')}
              className={`btn ${method === 'cash' ? 'bg-counter-accent text-counter-950 font-bold' : 'btn-ghost'}`}
            >
              {t('cash')}
            </button>
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`btn ${method === 'card' ? 'bg-counter-accent text-counter-950 font-bold' : 'btn-ghost'}`}
            >
              {t('card')}
            </button>
          </div>

          {method === 'cash' && (
            <div className="mt-3">
              <label className="label" htmlFor="tendered">
                {t('cashReceived')}
              </label>
              <input
                id="tendered"
                type="number"
                min="0"
                step="0.01"
                value={tendered}
                onChange={(event) => setTendered(event.target.value)}
                placeholder="0.00"
                className="field font-mono text-lg"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {QUICK_CASH.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTendered((amount / 100).toFixed(2))}
                    className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                  >
                    {amount / 100}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-400">{t('change')}</span>
                <span className="font-mono text-counter-good font-semibold">{formatMoney(changeCents)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={completeSale}
            disabled={cart.length === 0 || busy}
            className="btn-primary mt-3 h-12 w-full text-base font-semibold"
          >
            {busy ? t('saving') : `${t('completeSale')} ? ${formatMoney(totalCents)}`}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            {t('savedLocallyNote')}
          </p>
        </div>
      </aside>

      {result && (
        <ReceiptDialog
          result={result}
          onClose={() => {
            setResult(null)
            barcodeRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
