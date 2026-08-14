// Virtual list's row height. In rem, not px: the windowing maths needs a number, and a fixed px one
// would clip the row's own rem-sized content the moment a reader scales their text up.
export const ROW_HEIGHT_REM = 3.25

// One string for both the visible message and what the live region announces: they are shown under
// different conditions but must never word an empty list differently.
export const NO_TOKENS = 'No tokens found'

// The row wraps rather than scrolls, so an uncapped count is what pushes the card past its own
// max-height. Arbitrary, and low enough that the chips stay a shortcut rather than a second list.
export const MAX_FAVORITES = 8
