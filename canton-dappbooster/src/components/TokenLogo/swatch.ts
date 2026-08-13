export const SWATCH_COUNT = 8

/**
 * Picks the placeholder swatch for a token symbol: arbitrary, but the same symbol always lands on
 * the same one. The answer indexes the theme's `--cnc-swatch-*` roles, so the colour itself stays
 * in CSS and follows the mode.
 *
 * @example
 * swatchOf('CC') === swatchOf('CC') // true, and unrelated to swatchOf('USDC')
 */
export const swatchOf = (symbol: string): number => {
  let hash = 0
  for (const char of symbol) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_003
  }
  // Coprime with the count, so `MK7` and `MK8` land three swatches apart instead of adjacent.
  return ((hash * 3) % SWATCH_COUNT) + 1
}
