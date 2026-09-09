/**
 * The row a key moves the tab stop to, or `undefined` for a key that moves nothing and so must
 * keep its default behaviour. Out-of-range results are the caller's to clamp.
 *
 * @example
 * nextIndex('PageDown', 4, 10, 99) // 14
 */
export const nextIndex = (
  key: string,
  active: number,
  page: number,
  last: number,
): number | undefined => {
  switch (key) {
    case 'ArrowDown':
      return active + 1
    case 'ArrowUp':
      return active - 1
    case 'PageDown':
      return active + page
    case 'PageUp':
      return active - page
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return undefined
  }
}
