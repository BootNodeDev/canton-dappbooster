import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// In the URL, not page state, so /create opens the dialog over whichever page is showing
export const useCreateGrant = (): [boolean, (open: boolean) => void] => {
  const [params, setParams] = useSearchParams()

  // Stable identity: AppShell calls it from an effect that would otherwise rerun every render
  const setOpen = useCallback(
    (open: boolean): void =>
      setParams(
        (next) => {
          if (open) {
            next.set('create', '1')
          } else {
            next.delete('create')
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  return [params.get('create') === '1', setOpen]
}
