import type { AriaAttributes } from 'react'

type AriaInvalid = AriaAttributes['aria-invalid']

/**
 * Resolves a field's invalid state into the `aria-invalid` it carries for assistive tech and the
 * boolean the theme's `data-invalid` hook is written from. A consumer's own `aria-invalid` wins, so
 * an app can flag a field for a reason the kit cannot know.
 *
 * @example
 * const [invalid, flagged] = resolveInvalid(ariaInvalid, error !== undefined)
 */
export const resolveInvalid = (
  consumer: AriaInvalid,
  hasError: boolean,
): [AriaInvalid, boolean] => {
  const invalid = consumer ?? (hasError || undefined)
  return [invalid, Boolean(invalid) && invalid !== 'false']
}
