/**
 * Real-timer sleep; `pause(0)` flushes pending macrotasks.
 *
 *  How the suites await promise-settling sends.
 *
 *  Why not `waitFor`? a red should fail its assertion, not hang into a timeout.
 *
 * @example
 * actor.send({ type: 'restore' })
 * await pause(0)
 * expect(actor.getSnapshot().status).toBe('done')
 */
export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
