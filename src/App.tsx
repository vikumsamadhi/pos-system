import { useState } from 'react'
import CheckoutPage from './pages/CheckoutPage'
import ProductsPage from './pages/ProductsPage'
import ReportsPage from './pages/ReportsPage'
import { I18nProvider, useI18n } from './lib/i18n'

type Tab = 'checkout' | 'products' | 'reports'

function AppContent() {
  const [tab, setTab] = useState<Tab>('checkout')
  const { language, setLanguage, t } = useI18n()

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'checkout', label: t('tabCheckout') },
    { id: 'products', label: t('tabProducts') },
    { id: 'reports', label: t('tabReports') },
  ]

  return (
    <div className="flex h-full flex-col font-sans">
      <header className="flex items-center justify-between border-b border-white/5 bg-counter-900/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-counter-accent font-mono text-lg font-bold text-counter-950">
            P
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">
              {t('posCounter')}
            </div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">
              {t('offlineTerminal')}
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-xl bg-counter-950/60 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`tab ${tab === item.id ? 'tab-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {/* Language Selector Toggle */}
          <div className="flex items-center rounded-lg border border-white/10 bg-counter-950/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                language === 'en'
                  ? 'bg-counter-accent text-counter-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('si')}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                language === 'si'
                  ? 'bg-counter-accent text-counter-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ?????
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-counter-good" />
            {t('localDatabase')}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'checkout' && <CheckoutPage />}
        {tab === 'products' && <ProductsPage />}
        {tab === 'reports' && <ReportsPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
