// Regrouping the display rewrites everything to the *left* of the edit — a group separator appears
// or vanishes, a leading zero is dropped, a leading dot gains one — so the caret is anchored to the
// digits that follow it, which nothing touches. Anchoring on the digits before it instead strands a
// just-typed decimal separator in front of the caret, and the next digit lands in the integer part.

const DIGIT = /\d/

export const countDigitsAfter = (value: string, start: number): number => {
  let digits = 0
  for (let index = start; index < value.length; index += 1) {
    if (DIGIT.test(value[index])) digits += 1
  }
  return digits
}

// The rightmost position with `digits` digits after it, so a trailing separator stays behind the
// caret rather than in front of it. Falls back to the start when the value shrank below that count.
export const caretBeforeDigits = (display: string, digits: number): number => {
  let seen = 0
  let index = display.length
  while (seen < digits && index > 0) {
    index -= 1
    if (DIGIT.test(display[index])) seen += 1
  }
  return index
}

export const dropDigit = (value: string, caret: number, forward: boolean): [string, number] => {
  const step = forward ? 1 : -1
  let at = forward ? caret : Math.min(caret, value.length) - 1
  while (at >= 0 && at < value.length && !DIGIT.test(value[at])) at += step
  if (at < 0 || at >= value.length) return [value, caret]
  return [`${value.slice(0, at)}${value.slice(at + 1)}`, at]
}
