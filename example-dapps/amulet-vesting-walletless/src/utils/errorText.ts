export const errorText = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  // JSON before String(): an object stringifies to `[object Object]`, which says nothing
  try {
    const json = JSON.stringify(err)
    return json === undefined || json === '{}' ? String(err) : json
  } catch {
    return String(err)
  }
}
