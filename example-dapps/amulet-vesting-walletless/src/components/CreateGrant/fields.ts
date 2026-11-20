export const dateOf = (iso: string): string => iso.slice(0, 10)
export const atMidnight = (date: string): string => `${date}T00:00:00.000Z`

export const headingClass = 'font-heading text-base font-bold text-fg'
export const labelClass = 'block text-[0.8rem] font-semibold text-fg-muted'
export const inputClass =
  'mt-1.5 h-11 w-full rounded-control border border-border-strong bg-surface px-3.5 text-fg outline-none focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_22%,transparent)]'
