// Narrow an unknown thrown value to a displayable message. A non-Error throw
// (string, object) would leave (err as Error).message undefined in a toast.
export const errorText = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
