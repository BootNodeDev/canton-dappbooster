import { useSearchParams } from 'react-router-dom'
import type { Role } from '@/store/types'

// In the URL, not page state: it is who the reader is rather than a per-page filter, so it has to
// survive a walk into a grant and back, and a link can land on the lens that shows what was just
// created.
export const useRoleLens = (): [Role, (role: Role) => void] => {
  const [params, setParams] = useSearchParams()

  const setRole = (role: Role): void =>
    setParams(
      (next) => {
        next.set('role', role)
        return next
      },
      { replace: true },
    )

  return [params.get('role') === 'funder' ? 'funder' : 'receiver', setRole]
}
