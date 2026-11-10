import { useEffect } from 'react'

const APP_NAME = 'Canton Vesting'

// The router never reloads the document, so without this every tab, bookmark and history entry
// reads as whichever page the app first landed on.
export const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
    return () => {
      document.title = APP_NAME
    }
  }, [title])
}
