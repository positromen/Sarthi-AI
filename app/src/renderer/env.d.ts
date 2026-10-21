/// <reference types="vite/client" />
import type { SarthiApi } from '../preload'

declare global {
  interface Window {
    sarthi: SarthiApi
  }
}
