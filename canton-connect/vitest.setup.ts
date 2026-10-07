import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest 5's own createObjectURL shim throws `Cannot read properties of undefined (reading
// '_buffer')` on the Blob the SDK picker builds, so connect() dies before it can open a popup.
URL.createObjectURL = (object: Blob | MediaSource): string =>
  `blob:${window.location.origin}/${'size' in object ? object.size : 0}`
URL.revokeObjectURL = (): void => undefined

afterEach(() => {
  cleanup()
})
