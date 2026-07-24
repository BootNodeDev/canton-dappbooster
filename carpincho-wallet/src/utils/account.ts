import type { AccountPublic } from '@/vault/types'

export const shortMiddle = (value: string, head = 10, tail = 6): string => {
  if (value.length <= head + tail + 1) {
    return value
  }
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

export const sortAccounts = (accounts: AccountPublic[]): AccountPublic[] =>
  [...accounts].sort((a, b) =>
    a.isPrimary === b.isPrimary ? a.createdAt - b.createdAt : a.isPrimary ? -1 : 1,
  )
