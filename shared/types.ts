export type Unit = 'pcs' | 'kg' | 'g' | 'l' | 'ml' | 'pack'
export type PaymentMethod = 'cash' | 'card'
export type MovementReason =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'return'
  | 'adjustment'
  | 'waste'

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  nameSi?: string | null
  categoryId: number | null
  categoryName: string | null
  unit: Unit
  priceCents: number
  costCents: number
  taxRateBp: number
  isWeighed: boolean
  active: boolean
  reorderLevelMilli: number
  stockMilli: number
}

export interface NewProduct {
  sku: string
  barcode?: string | null
  name: string
  nameSi?: string | null
  categoryId?: number | null
  unit: Unit
  priceCents: number
  costCents?: number
  taxRateBp?: number
  isWeighed?: boolean
  reorderLevelMilli?: number
  openingStockMilli?: number
}

export interface UpdateProduct {
  id: number
  sku: string
  barcode?: string | null
  name: string
  nameSi?: string | null
  categoryId?: number | null
  unit: Unit
  priceCents: number
  costCents?: number
  taxRateBp?: number
  isWeighed?: boolean
  active?: boolean
  reorderLevelMilli?: number
}

export interface Category {
  id: number
  name: string
  sortOrder: number
}

export interface CartLineInput {
  productId: number
  qtyMilli: number
  unitPriceCents: number
  discountCents: number
  taxRateBp: number
}

export interface CheckoutInput {
  lines: CartLineInput[]
  payment: {
    method: PaymentMethod
    tenderedCents: number
  }
  discountCents: number
  cashierId?: number | null
  note?: string | null
}

export interface SaleTotals {
  subtotalCents: number
  discountCents: number
  taxCents: number
  totalCents: number
  changeCents: number
}

export interface ReceiptLine {
  name: string
  nameSi?: string | null
  qtyMilli: number
  unitPriceCents: number
  lineTotalCents: number
}

export interface Receipt {
  saleId: number
  receiptNo: string
  createdAt: string
  storeName: string
  storeAddress: string
  storePhone: string
  cashierName: string
  lines: ReceiptLine[]
  totals: SaleTotals
  paymentMethod: PaymentMethod
  tenderedCents: number
  footer: string
}

export interface CheckoutResult {
  receipt: Receipt
  escposBase64: string
}

export interface DailySummary {
  businessDate: string
  saleCount: number
  grossCents: number
  discountCents: number
  taxCents: number
  netCents: number
  cashCents: number
  cardCents: number
  itemsSoldMilli: number
  topItems: Array<{ name: string; qtyMilli: number; revenueCents: number }>
}

export interface PosApi {
  listProducts: (query?: string) => Promise<Product[]>
  findByBarcode: (barcode: string) => Promise<Product | null>
  listCategories: () => Promise<Category[]>
  createProduct: (product: NewProduct) => Promise<Product>
  updateProduct: (product: UpdateProduct) => Promise<Product>
  adjustStock: (input: {
    productId: number
    qtyChangeMilli: number
    reason: MovementReason
    note?: string | null
  }) => Promise<Product>
  checkout: (input: CheckoutInput) => Promise<CheckoutResult>
  dailySummary: (businessDate?: string) => Promise<DailySummary>
  getSettings: () => Promise<Record<string, string>>
  printReceipt: (escposBase64: string) => Promise<{ printed: boolean; message: string }>
  printReceiptHtml: (html: string) => Promise<{ printed: boolean; message: string }>
  saveReceiptHtml: (html: string, receiptNo: string) => Promise<string>
  receiptHtml: (saleId: number, lang?: 'en' | 'si' | 'both') => Promise<string>
}
