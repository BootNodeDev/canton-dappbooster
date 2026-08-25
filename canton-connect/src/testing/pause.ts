/**
 * Real-timer sleep, which is how a suite awaits a promise-settling send; `pause(0)` flushes the
 * pending macrotasks. Reach for it over `waitFor`, whose retry window turns a genuine red into a
 * timeout rather than a failed assertion.
 *
 * @example
 * await pause(0) // one macrotask on, so the send above has settled
 *
 * @category Utilities
 */
export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
