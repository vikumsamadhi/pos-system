import type { PosApi } from '@shared/types'

declare global {
  interface Window {
    pos: PosApi
  }
}

export {}
