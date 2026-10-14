/** Ctrl-C ended the run. The CLI exits with 130, as a shell does after SIGINT. */
export class CancelledError extends Error {
  constructor() {
    super('Cancelled.')
    this.name = 'CancelledError'
  }
}
