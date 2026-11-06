import type { PhoneMirrorApi } from '@shared/api'

declare global {
  interface Window {
    phoneMirror?: PhoneMirrorApi
  }
}

export {}
