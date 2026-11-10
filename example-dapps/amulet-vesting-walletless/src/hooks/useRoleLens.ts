import { useSearchParams } from 'react-router-dom'
import type { Role } from '@/store/types'

// In the URL, not page state, so the lens survives a walk into a grant and back
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
