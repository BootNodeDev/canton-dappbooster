import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Kit components ship zero styling; load the theme (tokens + defaults) explicitly.
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
import { App } from './App'
import './styles/index.css'

const rootEl = document.getElementById('root')
if (rootEl === null) {
  throw new Error('Root element #root not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
