import React from 'react'
import ReactDOM from 'react-dom/client'
// Kit components ship no styling; load the theme explicitly.
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
