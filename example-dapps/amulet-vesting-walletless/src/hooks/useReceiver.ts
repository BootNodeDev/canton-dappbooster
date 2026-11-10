import { isValidPartyId } from '@bootnodedev/canton-dappbooster'
import { useEffect, useState } from 'react'
import { ApiError, api } from '@/backend/api'

// The server's own rule for a username, so a name it would refuse is never looked up.
const USERNAME = /^[a-z0-9][a-z0-9-]{2,31}$/

// Typing pauses this long before a name is looked up, so each keystroke does not cost a request.
const LOOKUP_DELAY_MS = 300

export interface Receiver {
  message?: string
  // Set once the input names a party: typed out in full, or resolved from a username.
  partyId?: string
  resolving: boolean
  username?: string
}

type Lookup = { name: string; partyId?: string; failed?: string }

// A receiver is typed as a username, since nobody here has a wallet to copy a party id out of, or as
// a full party id for a party that signed up somewhere else.
export const useReceiver = (input: string): Receiver => {
  const typed = input.trim()
  const name = typed.toLowerCase()
  const isName = !typed.includes('::') && USERNAME.test(name)
  const [lookup, setLookup] = useState<Lookup>()

  useEffect(() => {
    if (!isName) return
    let live = true
    const timer = setTimeout(() => {
      api<{ partyId: string }>(`/users/${encodeURIComponent(name)}`).then(
        ({ partyId }) => {
          if (live) setLookup({ name, partyId })
        },
        (err: unknown) => {
          if (!live) return
          const missing = err instanceof ApiError && err.status === 404
          setLookup({ name, failed: missing ? `No user named ${name}.` : String(err) })
        },
      )
    }, LOOKUP_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [isName, name])

  if (typed === '') return { resolving: false }
  if (typed.includes('::')) {
    return isValidPartyId(typed)
      ? { partyId: typed, resolving: false }
      : { message: 'Use a full party id (hint::fingerprint) or a username.', resolving: false }
  }
  if (!isName) {
    return { message: 'Usernames are 3–32 lowercase letters, digits and dashes.', resolving: false }
  }
  // A lookup for an earlier name is still on screen until this one answers.
  if (lookup?.name !== name) return { resolving: true, username: name }
  return lookup.partyId === undefined
    ? { message: lookup.failed, resolving: false, username: name }
    : { partyId: lookup.partyId, resolving: false, username: name }
}
