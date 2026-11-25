const pad = (n: number): string => String(n).padStart(2, '0')

// A date input holds a local calendar day, the one formatDate shows back, so both ends stay local.
export const dateOf = (iso: string): string => {
  const day = new Date(iso)
  return Number.isNaN(day.getTime())
    ? ''
    : `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}
export const atMidnight = (date: string): string =>
  date === '' ? '' : new Date(`${date}T00:00`).toISOString()

export const headingClass = 'font-heading text-base font-bold text-fg'
export const labelClass = 'block text-[0.8rem] font-semibold text-fg-muted'
export const inputClass =
  'mt-1.5 h-11 w-full rounded-control border border-border-strong bg-surface px-3.5 text-fg outline-none focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_22%,transparent)]'
