// Not on the './testing' barrel: internal doubles for the window.open borrow, not published.

/** The `window.open()` handle shape `stubPopup()` builds and the SDK's real picker drives. */
export interface StubPopup {
  closed: boolean
  location: { href: string }
  focus: () => void
  close: () => void
  postMessage: () => void
  addEventListener: () => void
  removeEventListener: () => void
}

/** A popup handle with enough surface for the SDK's real picker to drive. */
export const stubPopup = (): StubPopup => ({
  closed: false,
  location: { href: '' },
  focus: () => undefined,
  close: () => undefined,
  postMessage: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})

// Assigned, not `vi.spyOn`: jsdom's window.open is an accessor, and a spy on it survives the
// borrow.
/** Replaces `window.open` with one returning `popup`; hands back the restore function. */
export const stubOpen = (popup: object | null): (() => void) => {
  const original = window.open
  window.open = (() => popup) as unknown as typeof window.open
  return () => {
    window.open = original
  }
}
