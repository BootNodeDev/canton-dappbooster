import type { InstrumentId } from '#src/providers/TokenListProvider/context'

// A slash separates them because neither field can hold one: a party id is `hint::fingerprint` and
// a registry's instrument id is a Daml identifier, so no two instruments share a key.
const SEPARATOR = '/'

/**
 * The string identity of an instrument, for a map key, a React key or an equality check. Compare
 * these rather than the `id` alone: two registries can both issue a `USDC`.
 *
 * @example
 * tokenKey({ admin: 'DSO::1220ab', id: 'Amulet' }) // 'DSO::1220ab/Amulet'
 *
 * @category Utilities
 */
export const tokenKey = ({ admin, id }: InstrumentId): string => `${admin}${SEPARATOR}${id}`
