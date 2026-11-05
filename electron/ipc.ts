import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import type { CheckoutInput, MovementReason, NewProduct, UpdateProduct } from '@shared/types'
import type { Db } from './db/database'
import { adjustStock, createProduct, findByBarcode, listCategories, listProducts, updateProduct } from './db/catalog'
import { checkout, dailySummary, getReceipt } from './db/sales'
import { buildReceiptHtml } from './printing/escpos'

interface IpcContext {
  db: Db
  receiptsDir: string
}

export function registerIpc({ db, receiptsDir }: IpcContext): void {
  ipcMain.handle('catalog:list', (_event, query?: string) => listProducts(db, query))
  ipcMain.handle('catalog:barcode', (_event, barcode: string) => findByBarcode(db, barcode))
  ipcMain.handle('catalog:categories', () => listCategories(db))
  ipcMain.handle('catalog:create', (_event, product: NewProduct) => createProduct(db, product))
  ipcMain.handle('catalog:update', (_event, product: UpdateProduct) => updateProduct(db, product))
  ipcMain.handle(
    'catalog:adjust',
    (
      _event,
      input: { productId: number; qtyChangeMilli: number; reason: MovementReason; note?: string | null },
    ) => adjustStock(db, input),
  )

  ipcMain.handle('sale:checkout', (_event, input: CheckoutInput) => checkout(db, input))
  ipcMain.handle('sale:receipt', (_event, saleId: number) => getReceipt(db, saleId))
  ipcMain.handle('report:daily', (_event, date?: string) => dailySummary(db, date))

  ipcMain.handle('settings:get', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  })

  ipcMain.handle('receipt:save-html', (_event, html: string, receiptNo: string) => {
    fs.mkdirSync(receiptsDir, { recursive: true })
    const safeName = receiptNo.replace(/[^A-Za-z0-9_-]/g, '_')
    const target = path.join(receiptsDir, `${safeName}.html`)
    fs.writeFileSync(target, html, 'utf8')
    return target
  })

  ipcMain.handle('receipt:print-html', async (_event, html: string) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    try {
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      return await new Promise<{ printed: boolean; message: string }>((resolve) => {
        printWin.webContents.print(
          {
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            printWin.close()
            if (!success) {
              resolve({ printed: false, message: failureReason || 'Print canceled' })
            } else {
              resolve({ printed: true, message: 'Receipt printed successfully.' })
            }
          },
        )
      })
    } catch (err) {
      if (!printWin.isDestroyed()) printWin.close()
      return {
        printed: false,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('receipt:print', (_event, escposBase64: string) => {
    const settings = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    const map = Object.fromEntries(settings.map((row) => [row.key, row.value]))
    const bytes = Buffer.from(escposBase64, 'base64')
    if (!map.printer_name) {
      return {
        printed: false,
        message: `No printer configured. ESC/POS receipt generated (${bytes.length} bytes). Use Print Receipt for Sinhala/English output.`,
      }
    }
    return {
      printed: false,
      message: `Printer "${map.printer_name}" is configured, but raw ESC/POS output is not wired to a device yet.`,
    }
  })

  ipcMain.handle('receipt:preview-html', (_event, saleId: number, lang?: 'en' | 'si' | 'both') =>
    buildReceiptHtml(getReceipt(db, saleId), lang || 'si'),
  )
}
