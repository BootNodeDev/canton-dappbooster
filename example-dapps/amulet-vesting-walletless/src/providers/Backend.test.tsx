import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => vi.fn())
const session = vi.hoisted(() => ({
  current: { partyId: 'party::1', username: 'alice' } as
    | { partyId: string; username: string }
    | undefined,
}))

vi.mock('@/backend/api', () => ({ api }))
vi.mock('@/providers/Session', () => ({
  useSession: () => ({ pending: false, session: session.current }),
}))

const { Backend, useBackend } = await import('@/providers/Backend')

const BOOTSTRAP = 'no vesting operator on this ledger — run pnpm run bootstrap'

const roots: { unmount: () => void }[] = []

type Seen = { configError: string | undefined; configPending: boolean; ready: boolean }

const Probe = ({ seen }: { seen: Seen[] }): null => {
  const state = useBackend()
  seen.push({
    configError: state.configError,
    configPending: state.configPending,
    ready: state.ready,
  })
  return null
}

const mount = async (seen: Seen[]): Promise<void> => {
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  await act(async () => {
    root.render(
      <Backend>
        <Probe seen={seen} />
      </Backend>,
    )
  })
}

describe('Backend', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots.length = 0
    vi.useRealTimers()
    vi.clearAllMocks()
    session.current = { partyId: 'party::1', username: 'alice' }
  })

  it('reports the server’s deployment error, then drops it once a recheck finds one', async () => {
    vi.useFakeTimers()
    api.mockResolvedValueOnce({ ready: false, error: BOOTSTRAP })
    const seen: Seen[] = []
    await mount(seen)

    expect(seen.at(-1)).toEqual({ configError: BOOTSTRAP, configPending: false, ready: false })

    api.mockResolvedValueOnce({ ready: true })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(seen.at(-1)).toEqual({ configError: undefined, configPending: false, ready: true })
  })

  it('asks nothing and is not ready while nobody is signed in', async () => {
    session.current = undefined
    const seen: Seen[] = []
    await mount(seen)

    expect(api).not.toHaveBeenCalled()
    expect(seen.at(-1)).toEqual({ configError: undefined, configPending: false, ready: false })
  })
})
