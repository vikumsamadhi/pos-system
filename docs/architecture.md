# Architecture

## Process split

```
renderer (React)                     main (Node/Electron)
  window.pos  ── IPC invoke ──▶  ipc.ts  ──▶  db/*.ts  ──▶  better-sqlite3
                                                   │
                                                   └──▶  printing/escpos.ts
```

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer never touches the filesystem or SQLite. Everything goes through
  the typed `PosApi` in `shared/types.ts`, exposed by `electron/preload.ts`.
- The main process owns the single database handle and closes it with
  `wal_checkpoint(TRUNCATE)` on quit.

## Database

SQLite with:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

WAL + NORMAL survives process crashes; the OS page cache is flushed at
checkpoints. A power cut can lose the last transactions in flight but will not
corrupt the file. Physical durability on a shop PC should be verified on real
hardware (see QA checklist).

Tables: `schema_meta`, `settings`, `counters`, `users`, `categories`,
`products`, `sales`, `sale_items`, `payments`, `inventory_movements`,
`audit_log`. `product_stock` is a view over the movement ledger.

Schema is applied idempotently at startup from `db/schema.sql` (bundled into the
main process with `?raw`), so a new install needs no migration tool yet.

## Checkout transaction

1. Load each product and snapshot name, SKU, unit price and tax rate.
2. Line subtotal = `round(qty_milli * unit_price_cents / 1000)`.
3. Order discount is distributed proportionally across lines, remainder to the
   last line, so line totals always add up to the order total.
4. Tax per line = `round(net * tax_rate_bp / 10000)`.
5. Cash requires `tendered >= total`; change = tendered − total.
6. In one transaction: increment the receipt counter (`RETURNING value`), insert
   `sales`, `sale_items`, `payments`, one `sale` movement per item, and an
   `audit_log` row.
7. Build the receipt and ESC/POS bytes after the commit and return both.

Receipt numbers look like `INV-000001`.

## Money and quantities

- Prices, costs, totals: integer cents (`1250` = LKR 12.50).
- Quantities: integer milli-units (`1500` = 1.5 kg). `QTY_SCALE = 1000`.
- Tax rates: basis points (`800` = 8%).

Never do arithmetic on floating-point currency in the renderer; use
`shared/money.ts`.

## Known gaps (Phase 1)

- Raw ESC/POS device output (see `docs/printing.md`).
- PIN login exists in the schema but the app currently opens as the manager.
- No refunds/void UI yet; the schema already supports `sales.status` and the
  `return` movement reason.
