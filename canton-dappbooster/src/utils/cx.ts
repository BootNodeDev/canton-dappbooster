// Joins a component's own part class with whatever the consumer passed, dropping the empties.
export const cx = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ')
