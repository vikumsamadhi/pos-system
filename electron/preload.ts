import { contextBridge, ipcRenderer } from 'electron'
import type { CheckoutInput, MovementReason, NewProduct, PosApi, UpdateProduct } from '@shared/types'

const api: PosApi = {
  listProducts: (query?: string) => ipcRenderer.invoke('catalog:list', query),
  findByBarcode: (barcode: string) => ipcRenderer.invoke('catalog:barcode', barcode),
  listCategories: () => ipcRenderer.invoke('catalog:categories'),
  createProduct: (product: NewProduct) => ipcRenderer.invoke('catalog:create', product),
  updateProduct: (product: UpdateProduct) => ipcRenderer.invoke('catalog:update', product),
  adjustStock: (input: { productId: number; qtyChangeMilli: number; reason: MovementReason; note?: string | null }) =>
    ipcRenderer.invoke('catalog:adjust', input),
  checkout: (input: CheckoutInput) => ipcRenderer.invoke('sale:checkout', input),
  dailySummary: (businessDate?: string) => ipcRenderer.invoke('report:daily', businessDate),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  printReceipt: (escposBase64: string) => ipcRenderer.invoke('receipt:print', escposBase64),
  printReceiptHtml: (html: string) => ipcRenderer.invoke('receipt:print-html', html),
  saveReceiptHtml: (html: string, receiptNo: string) => ipcRenderer.invoke('receipt:save-html', html, receiptNo),
  receiptHtml: (saleId: number, lang?: 'en' | 'si' | 'both') => ipcRenderer.invoke('receipt:preview-html', saleId, lang),
}

contextBridge.exposeInMainWorld('pos', api)
