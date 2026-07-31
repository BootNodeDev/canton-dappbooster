import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Both outlive a test: localStorage is per-origin and data-theme is written to the shared <html>.
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
