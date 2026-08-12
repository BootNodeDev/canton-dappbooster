/**
 * Picks the placeholder hue for a token symbol: arbitrary, but the same symbol always lands on the
 * same one.
 *
 * @example
 * hueOf('CC') === hueOf('CC') // true, and unrelated to hueOf('USDC')
 */
export const hueOf = (symbol: string): number => {
  let hash = 0
  for (const char of symbol) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_003
  }
  // Golden-angle step, so `MK7` and `MK8` land a third of the circle apart instead of one degree.
  return (hash * 137) % 360
}
