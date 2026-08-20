import type { Token } from '#src/providers/TokenListProvider/context'

// One name for both surfaces that offer a token: a list row and a favourite chip for the same token
// sit in one dialog and must never be named differently.
export const tokenLabel = (token: Token): string => `${token.name} ${token.symbol}`
