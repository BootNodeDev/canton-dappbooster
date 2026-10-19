// Nothing pushes ledger changes to a browser today, so the default source is a timer.
const DEFAULT_POLL_MS = 3000

/**
 * Tells a watched read when the ledger may have moved: it is handed a `tick` to call and returns
 * its own teardown, so a timer, a server-sent event stream or a socket all fit.
 *
 * @category Types
 */
export type WatchSource = (tick: () => void) => () => void

/**
 * A {@link WatchSource} on a timer, ticking every `ms`, 3 seconds unless told; `watch: true` is
 * this with the default.
 *
 * @example
 * useActiveContracts({ templateId: '#my-app:Main:Grant', decode: toGrant, watch: pollEvery(1000) })
 *
 * @category Utilities
 */
export const pollEvery =
  (ms: number = DEFAULT_POLL_MS): WatchSource =>
  (tick) => {
    const timer = setInterval(tick, ms)

    return () => clearInterval(timer)
  }
