// Narrow an unknown thrown value to a displayable message. A non-Error throw (string, object) would
// leave (err as Error).message undefined in a toast, and String() collapses an object to
// `[object Object]` — the payload, however raw, at least says what failed.
export const errorText = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  try {
    const json = JSON.stringify(err)
    return json === undefined || json === '{}' ? String(err) : json
  } catch {
    return String(err)
  }
}
