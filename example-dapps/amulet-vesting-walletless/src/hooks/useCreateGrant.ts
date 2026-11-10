import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// Kept in the URL rather than in page state, so /create can open the dialog on whichever page the
// reader is already on, and closing frees that link to open it again.
export const useCreateGrant = (): [boolean, (open: boolean) => void] => {
  const [params, setParams] = useSearchParams()

  // Memoized because AppShell closes the dialog from an effect: a new identity every render would
  // run that effect every render.
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
