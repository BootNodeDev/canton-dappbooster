// The seam the Canton Event Stream proposal would fill: nothing pushes to a browser today, so the
// default source is a timer, and a dApp that gains a push channel passes its own.
const DEFAULT_POLL_MS = 3000

/**
 * Tells a watched read when the ledger may have moved. It is handed a `tick` to call and returns
 * its own teardown, so a timer, an SSE stream or a socket all fit the same seam.
 *
 * @category Types
 */
export type WatchSource = (tick: () => void) => () => void

/**
 * A {@link WatchSource} on a timer, which is what `watch: true` uses.
 *
 * @example
 * useActiveContracts({ templateId: '#my-app:Main:Grant', watch: pollEvery(1000) })
 *
 * @category Utilities
 */
export const pollEvery =
  (ms: number = DEFAULT_POLL_MS): WatchSource =>
  (tick) => {
    const timer = setInterval(tick, ms)

    return () => clearInterval(timer)
  }
