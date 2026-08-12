// Virtual list's row height. In rem, not px: the windowing maths needs a number, and a fixed px one
// would clip the row's own rem-sized content the moment a reader scales their text up.
export const ROW_HEIGHT_REM = 3.25

// One string for both the visible message and what the live region announces: they are shown under
// different conditions but must never word an empty list differently.
export const NO_TOKENS = 'No tokens found'
