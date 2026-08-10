// Regrouping the display rewrites everything to the *left* of the edit — a group separator appears
// or vanishes, a leading zero is dropped, a leading dot gains one — so the caret is anchored to the
// digits that follow it, which nothing touches. Anchoring on the digits before it instead strands a
// just-typed decimal separator in front of the caret, and the next digit lands in the integer part.

const DIGIT = /\d/

export const countDigitsAfter = (value: string, start: number): number =>
  (value.slice(start).match(/\d/g) ?? []).length

// The rightmost position with `digits` digits after it, so a trailing separator stays behind the
// caret rather than in front of it. Falls back to the start when the value shrank below that count.
export const caretBeforeDigits = (display: string, digits: number): number => {
  let seen = 0
  let index = display.length
  while (seen < digits && index > 0) {
    index -= 1
    if (DIGIT.test(display[index] ?? '')) seen += 1
  }
  return index
}

export const dropDigit = (value: string, caret: number, forward: boolean): [string, number] => {
  let index = caret
  if (forward) {
    while (index < value.length && !DIGIT.test(value[index] ?? '')) index += 1
    if (index === value.length) return [value, caret]
    return [`${value.slice(0, index)}${value.slice(index + 1)}`, index]
  }
  while (index > 0 && !DIGIT.test(value[index - 1] ?? '')) index -= 1
  if (index === 0) return [value, caret]
  return [`${value.slice(0, index - 1)}${value.slice(index)}`, index - 1]
}
