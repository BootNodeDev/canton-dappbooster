// `crypto.randomUUID` exists only in a secure context, so a demo served from a plain-http LAN
// address has none and every toast would throw on push. `getRandomValues` is available either way.
export const randomId = (): string => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
