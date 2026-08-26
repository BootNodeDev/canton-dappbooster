// Schedule timestamps are full ISO so demo presets can build sub-day windows; the date inputs bind
// to the calendar-day part and reset the time to midnight when edited.
export const dateOf = (iso: string): string => iso.slice(0, 10)
export const atMidnight = (date: string): string => `${date}T00:00:00.000Z`

export const labelClass = 'block text-xs font-bold uppercase tracking-[0.06em] text-fg-muted'
export const inputClass =
  'mt-1.5 h-11 w-full rounded-[8px] border border-border bg-bg px-3 text-fg outline-none focus:shadow-[var(--ring)]'
