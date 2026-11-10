import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
// Single stylesheet entry: it owns the cascade layer order, Tailwind, and the kit theme.
import '@/styles/index.css'

const rootEl = document.getElementById('root')
if (rootEl === null) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
