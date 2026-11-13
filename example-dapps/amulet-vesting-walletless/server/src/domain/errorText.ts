export const errorText = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  // String() turns an object into `[object Object]`; its JSON at least says what failed.
  try {
    const json = JSON.stringify(err)
    return json === undefined || json === '{}' ? String(err) : json
  } catch {
    return String(err)
  }
}
