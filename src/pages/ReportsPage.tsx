import { useCallback, useEffect, useState } from 'react'
import type { DailySummary } from '@shared/types'
import { formatMoney, formatQty, todayIso } from '@shared/money'
import { useI18n } from '../lib/i18n'

export default function ReportsPage() {
  const { t } = useI18n()
  const [date, setDate] = useState(todayIso())
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (businessDate: string) => {
    setLoading(true)
    setError(null)
    try {
      setSummary(await window.pos.dailySummary(businessDate))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [date, load])

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">{t('dailyReport')}</h1>
            <p className="text-xs text-slate-500">{t('readDirectLedger')}</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="label" htmlFor="report-date">
                {t('businessDate')}
              </label>
              <input
                id="report-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="field font-mono"
              />
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void load(date)}
              disabled={loading}
            >
              {loading ? '...' : t('refresh')}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {summary && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="stat">
                <div className="stat-label">{t('netSales')}</div>
                <div className="stat-value text-counter-accent">{formatMoney(summary.netCents, 'Rs. ')}</div>
                <div className="mt-1 text-xs text-slate-500">{summary.saleCount} {t('salesCount')}</div>
              </div>
              <div className="stat">
                <div className="stat-label">{t('cash')}</div>
                <div className="stat-value">{formatMoney(summary.cashCents, 'Rs. ')}</div>
              </div>
              <div className="stat">
                <div className="stat-label">{t('card')}</div>
                <div className="stat-value">{formatMoney(summary.cardCents, 'Rs. ')}</div>
              </div>
              <div className="stat">
                <div className="stat-label">{t('taxCollected')}</div>
                <div className="stat-value">{formatMoney(summary.taxCents, 'Rs. ')}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="stat">
                <div className="stat-label">{t('grossSales')}</div>
                <div className="stat-value text-xl">{formatMoney(summary.grossCents, 'Rs. ')}</div>
              </div>
              <div className="stat">
                <div className="stat-label">{t('discounts')}</div>
                <div className="stat-value text-xl text-counter-warn">{formatMoney(summary.discountCents, 'Rs. ')}</div>
              </div>
              <div className="stat">
                <div className="stat-label">{t('itemsSold')}</div>
                <div className="stat-value text-xl">{formatQty(summary.itemsSoldMilli, '')}</div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
                {t('topItems')}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2">{t('productHeader')}</th>
                    <th className="px-4 py-2 text-right">{t('qtyHeader')}</th>
                    <th className="px-4 py-2 text-right">{t('revenueHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topItems.map((item) => (
                    <tr key={item.name} className="border-t border-white/5">
                      <td className="px-4 py-2 text-slate-200">{item.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400">
                        {formatQty(item.qtyMilli, '')}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-200">
                        {formatMoney(item.revenueCents, 'Rs. ')}
                      </td>
                    </tr>
                  ))}
                  {summary.topItems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        {t('noSalesDate')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
