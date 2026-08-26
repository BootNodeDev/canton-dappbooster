import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Role } from '@/store/types'

// Page-local so switching sections resets it; the initial value comes from the URL, which is how a
// link can land on the lens that shows what the user just created.
export const useRoleLens = (): [Role, (role: Role) => void] => {
  const [params] = useSearchParams()
  return useState<Role>(params.get('role') === 'funder' ? 'funder' : 'receiver')
}
