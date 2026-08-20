import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The wallet SDK sleeps 300ms announcing providers, once on init and again on connect, so a
// connect-flow assertion starts 600ms behind and the 1s default fails under load.
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
  // Both outlive a test: localStorage is per-origin and data-theme is written to the shared <html>.
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
