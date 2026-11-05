# POS Counter

Offline-first point of sale for a single retail / supermarket / grocery counter.
Electron + React + TypeScript + Tailwind, local SQLite in WAL mode, 80 mm ESC/POS receipts.
No cloud, no network dependency: the counter keeps selling when the internet is down.

## Requirements

- Windows 10/11
- Node.js 22+ (built with Node 24)
- Visual Studio Build Tools (C++ workload) for the native `better-sqlite3` module

## Getting started

```bash
npm install          # also rebuilds better-sqlite3 against Electron
npm run dev          # Vite + Electron with hot reload
npm run typecheck    # renderer and main-process type checks
npm run build        # typecheck + production bundles (dist/, dist-electron/)
npm start            # run the production build
```

The database is created on first launch at:

```
%APPDATA%\pos-system\pos.db
```

Override it with `POS_DB_PATH` (useful for testing and for moving the data folder to another drive).

## Default data

| Item | Value |
| --- | --- |
| Currency | LKR |
| Receipt width | 80 mm (48 columns) |
| Manager PIN | `1234` |
| Cashier PIN | `0000` |
| Sample catalog | 6 categories, 18 grocery products with EAN-13 barcodes and opening stock |

Change the store details in `settings` (store_name, store_address, store_phone, printer_name).

## Layout

```
db/schema.sql              canonical SQLite schema (source of truth)
electron/main.ts           app lifecycle, window, database init
electron/preload.ts        contextBridge -> window.pos
electron/ipc.ts            IPC handlers (the only main<->renderer surface)
electron/db/               database, seed, catalog, sales
electron/printing/         ESC/POS bytes + HTML receipt preview
shared/                    types and money/qty helpers used by both sides
src/                       renderer (checkout, products & stock, daily report)
docs/                      architecture, printing, QA checklist
```

## Data model rules

- Money is stored as integer cents; quantities as milli-units (1.000 = one unit).
- Stock is never a mutable column. `inventory_movements` is append-only and
  `product_stock` is a view that sums it. Sales, deliveries, returns and
  adjustments all write movements in the same transaction as the document.
- Checkout is a single SQLite transaction: sale, items, payment, stock movements,
  receipt counter and audit entry commit together or not at all.
- Negative stock is allowed and surfaced in the UI; the counter is never blocked
  by a stock mismatch.

## Phase 1 scope

Working: barcode / search checkout, weighed quantities, cash and card payment,
cash tender + change, 80 mm receipt bytes and HTML preview, product management,
stock adjustments, daily report. Raw ESC/POS device output is the remaining
step and needs the printer attached — see `docs/printing.md`.
