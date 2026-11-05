# QA checklist — Phase 1

Run on the real counter PC, not a dev machine, before the shop uses it.

## Install and startup

- [ ] `npm install` completes and `better-sqlite3` loads inside Electron
- [ ] `npm run build` passes typecheck
- [ ] `npm start` opens the window with no console errors
- [ ] Second launch reuses the same database (products and sales are still there)
- [ ] `%APPDATA%\pos-system\pos.db` exists; running `PRAGMA journal_mode` returns `wal`

## Checkout

- [ ] Scan an EAN-13 barcode → correct product lands in the cart, qty 1
- [ ] Scan the same barcode twice → one line, qty 2
- [ ] Unknown barcode shows a clear message and does not add a line
- [ ] Search by name and by SKU adds the right product
- [ ] Weighed item (kg) accepts 0.250 / 1.375 and computes the right line total
- [ ] Qty +/− and direct entry keep totals in sync
- [ ] Remove line recalculates totals
- [ ] Cash less than total is refused
- [ ] Cash equal to total completes with change 0.00
- [ ] Over-tender shows correct change
- [ ] Card sale completes without a tender amount
- [ ] Receipt number increments by exactly 1 per sale, no gaps after a restart
- [ ] Sale appears in the daily report with the right totals
- [ ] Stock decreased by exactly the sold quantity
- [ ] Selling below zero stock warns but still completes

## Data integrity

- [ ] Kill the app during checkout → no half-written sale (sale and items both absent)
- [ ] Hard power cut after a completed sale → sale is still there after restart
- [ ] `inventory_movements` row count = opening + sales + adjustments
- [ ] `product_stock` matches the product screen for every item
- [ ] Adjust stock with a negative number records a movement and audit entry
- [ ] Audit log captures product creation and stock adjustments

## Receipt

- [ ] Receipt HTML preview matches the on-screen totals
- [ ] Saved HTML file opens and prints at 80 mm without clipping
- [ ] ESC/POS bytes are produced for every sale (byte count > 0)
- [ ] On real hardware: header, items, total, footer, cut and drawer kick all work
- [ ] LKR amounts align and never wrap on the 48-column layout

## Offline

- [ ] Unplug the network → app starts and sells normally
- [ ] No external requests are made during a sale (DevTools network tab)

## Hardware

- [ ] Barcode scanner (keyboard wedge) works with focus in the scan field
- [ ] Scanner suffix is Enter; no stray characters in other fields
- [ ] Cash drawer opens on cash sale (if wired)
- [ ] Printer model / connection / driver recorded in `docs/printing.md`
