import { useEffect, useState } from 'react'
import type { CheckoutResult } from '@shared/types'
import { useI18n } from '../lib/i18n'

interface Props {
  result: CheckoutResult
  onClose: () => void
}

type ReceiptLang = 'si' | 'en' | 'both'

export default function ReceiptDialog({ result, onClose }: Props) {
  const { t, language } = useI18n()
  const { receipt } = result
  const [receiptLang, setReceiptLang] = useState<ReceiptLang>(language === 'si' ? 'si' : 'both')
  const [message, setMessage] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Load preview HTML whenever bill language changes
  useEffect(() => {
    let cancelled = false
    window.pos.receiptHtml(receipt.saleId, receiptLang).then((html) => {
      if (!cancelled) setPreviewHtml(html)
    })
    return () => {
      cancelled = true
    }
  }, [receipt.saleId, receiptLang])

  async function handlePrint() {
    setBusy(true)
    setMessage(null)
    try {
      const htmlToPrint = previewHtml ?? (await window.pos.receiptHtml(receipt.saleId, receiptLang))
      // Print via native Windows thermal printer driver with full Sinhala font rasterization
      const outcome = await window.pos.printReceiptHtml(htmlToPrint)
      setMessage(outcome.message)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveHtml() {
    setBusy(true)
    setMessage(null)
    try {
      const htmlToSave = previewHtml ?? (await window.pos.receiptHtml(receipt.saleId, receiptLang))
      const filePath = await window.pos.saveReceiptHtml(htmlToSave, receipt.receiptNo)
      setMessage(`Receipt saved to: ${filePath}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-counter-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('saleComplete')}</h2>
            <p className="text-xs text-slate-400">
              {receipt.receiptNo} ? {receipt.createdAt} ? {receipt.cashierName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost">
            {t('close')}
          </button>
        </div>

        {/* Bill Language Switcher */}
        <div className="flex items-center justify-between bg-counter-950/80 px-5 py-2.5 border-b border-white/5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('receiptLang')}
          </span>
          <div className="flex rounded-lg border border-white/10 bg-counter-900 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setReceiptLang('si')}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                receiptLang === 'si'
                  ? 'bg-counter-accent text-counter-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('langSinhala')}
            </button>
            <button
              type="button"
              onClick={() => setReceiptLang('both')}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                receiptLang === 'both'
                  ? 'bg-counter-accent text-counter-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('langBoth')}
            </button>
            <button
              type="button"
              onClick={() => setReceiptLang('en')}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                receiptLang === 'en'
                  ? 'bg-counter-accent text-counter-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('langEnglish')}
            </button>
          </div>
        </div>

        {/* Receipt HTML Preview */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 bg-counter-950/40">
          {previewHtml ? (
            <div className="flex justify-center">
              <iframe
                title="Receipt Preview"
                srcDoc={previewHtml}
                className="h-[440px] w-[340px] rounded-lg bg-white shadow-lg border border-slate-700"
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              Loading preview...
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-lg border border-counter-accent/30 bg-counter-accent/10 px-3 py-2 text-sm text-counter-accent">
              {message}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 border-t border-white/5 px-5 py-4 bg-counter-900">
          <button
            type="button"
            onClick={handlePrint}
            disabled={busy}
            className="btn-primary flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {busy ? t('saving') : t('printReceipt')}
          </button>
          <button
            type="button"
            onClick={handleSaveHtml}
            disabled={busy}
            className="btn-ghost flex-1 py-2.5 text-sm font-semibold"
          >
            {t('previewAndSave')}
          </button>
        </div>
      </div>
    </div>
  )
}
