// jsdom defines no clipboard. Pass `undefined` to model an insecure context, or to reset.
export const stubClipboard = (writeText: ((value: string) => Promise<void>) | undefined): void => {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
  })
}
