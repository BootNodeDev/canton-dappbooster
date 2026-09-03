// The surface every Ark popover panel sits on. The z-index belongs here rather than on each
// positioner: Zag copies the content's computed z-index onto the positioner as an inline style, so
// a class on the positioner never wins. Radius and padding are the caller's, since `cn` is a plain
// join and could not override them.
export const popoverClass =
  'z-[60] border border-border bg-surface shadow-[var(--shadow-popover)] focus-visible:outline-none'

// A row in one of those panels. `cursor-pointer` because the app's preflight restoration only
// covers buttons, and an Ark item is an option or a menuitemradio.
export const popoverItemClass =
  'cursor-pointer rounded-md px-3 py-1.5 text-left font-semibold text-fg-muted transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-fg data-[state=checked]:bg-primary-soft data-[state=checked]:text-fg'
