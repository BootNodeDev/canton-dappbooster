import type { CSSProperties } from 'react'

/**
 * Hides an element visually while leaving it in the accessibility tree. Inline rather than themed
 * because a live region is load-bearing with no CSS loaded, and `display: none` would drop it out
 * of the tree entirely.
 *
 * @example
 * <span role="status" style={SR_ONLY}>{message}</span>
 */
export const SR_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  border: 0,
  clipPath: 'inset(50%)',
}
