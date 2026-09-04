const DIGIT = /\d/

export const countDigitsAfter = (value: string, start: number): number => {
  let digits = 0
  for (let index = start; index < value.length; index += 1) {
    if (DIGIT.test(value[index])) digits += 1
  }
  return digits
}

// Rightmost position with `digits` digits after it, so a trailing separator stays behind the caret.
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
