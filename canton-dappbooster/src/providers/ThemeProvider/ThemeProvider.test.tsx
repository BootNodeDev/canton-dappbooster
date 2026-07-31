import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { stubPrefersDark } from '../../testing/matchMedia'
import { ThemeProvider, type ThemeProviderProps } from '.'
import { DEFAULT_STORAGE_KEY } from './constants'
import { useTheme } from './useTheme'

const Probe = (): React.JSX.Element => {
  const { mode, resolved, setMode, toggle } = useTheme()
  return (
    <>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={() => setMode('light')}>
        light
      </button>
      <button type="button" onClick={() => setMode('system')}>
        system
      </button>
      <button type="button" onClick={toggle}>
        toggle
      </button>
    </>
  )
}

const shown = (id: 'mode' | 'resolved'): string | null => screen.getByTestId(id).textContent

const applied = (): string | undefined => document.documentElement.dataset.theme

const click = (name: string): void => {
  act(() => {
    screen.getByRole('button', { name }).click()
  })
}

const mount = (props?: Omit<ThemeProviderProps, 'children'>) =>
  render(
    <ThemeProvider {...props}>
      <Probe />
    </ThemeProvider>,
  )

describe('ThemeProvider', () => {
  it('applies the stored mode over the OS preference', () => {
    localStorage.setItem(DEFAULT_STORAGE_KEY, 'dark')
    stubPrefersDark(false)

    mount()

    expect(shown('mode')).toBe('dark')
    expect(shown('resolved')).toBe('dark')
    expect(applied()).toBe('dark')
  })

  it('resolves system mode from the OS preference', () => {
    stubPrefersDark(true)

    mount()

    expect(shown('mode')).toBe('system')
    expect(shown('resolved')).toBe('dark')
    expect(applied()).toBe('dark')
  })

  // setMode writes the literal 'system', so this is the round trip a reload takes.
  it('reads a stored system choice back as system', () => {
    localStorage.setItem(DEFAULT_STORAGE_KEY, 'system')
    stubPrefersDark(true)

    mount()

    expect(shown('mode')).toBe('system')
    expect(shown('resolved')).toBe('dark')
  })

  it('persists an explicit choice and restores it on remount', () => {
    stubPrefersDark(true)
    const { unmount } = mount()

    click('light')
    expect(applied()).toBe('light')
    unmount()

    mount()

    expect(shown('mode')).toBe('light')
    expect(applied()).toBe('light')
  })

  it('follows OS changes while in system mode', () => {
    const setPrefersDark = stubPrefersDark(false)
    mount()
    expect(shown('resolved')).toBe('light')

    act(() => {
      setPrefersDark(true)
    })

    expect(shown('mode')).toBe('system')
    expect(shown('resolved')).toBe('dark')
    expect(applied()).toBe('dark')
  })

  it('ignores OS changes once the user has chosen a mode', () => {
    const setPrefersDark = stubPrefersDark(false)
    mount()
    click('light')

    act(() => {
      setPrefersDark(true)
    })

    expect(shown('resolved')).toBe('light')
    expect(applied()).toBe('light')
  })

  it('returns to the OS preference when set back to system', () => {
    stubPrefersDark(true)
    mount()
    click('light')

    click('system')

    expect(shown('mode')).toBe('system')
    expect(shown('resolved')).toBe('dark')
    expect(applied()).toBe('dark')
  })

  it('toggle leaves system mode for the opposite of what is showing', () => {
    stubPrefersDark(true)
    mount()

    click('toggle')

    expect(shown('mode')).toBe('light')
    expect(applied()).toBe('light')
  })

  // jsdom never fires storage events of its own, so the event is the only thing worth asserting on.
  it('follows a mode change made in another tab', () => {
    stubPrefersDark(false)
    mount()

    act(() => {
      localStorage.setItem(DEFAULT_STORAGE_KEY, 'dark')
      window.dispatchEvent(
        new StorageEvent('storage', { key: DEFAULT_STORAGE_KEY, newValue: 'dark' }),
      )
    })

    expect(shown('mode')).toBe('dark')
    expect(applied()).toBe('dark')
  })

  it('falls back to system when another tab clears the store', () => {
    localStorage.setItem(DEFAULT_STORAGE_KEY, 'light')
    stubPrefersDark(true)
    mount()
    expect(shown('mode')).toBe('light')

    act(() => {
      localStorage.clear()
      // A cleared store arrives as a null key, meaning every key changed at once.
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })

    expect(shown('mode')).toBe('system')
    expect(applied()).toBe('dark')
  })

  it('ignores another tab writing an unrelated key', () => {
    stubPrefersDark(false)
    mount()
    click('light')

    act(() => {
      localStorage.setItem('other', 'dark')
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'dark' }))
    })

    expect(shown('mode')).toBe('light')
    expect(applied()).toBe('light')
  })

  it('reads and writes the storage key it was given', () => {
    localStorage.setItem('app-theme', 'dark')
    stubPrefersDark(false)

    mount({ storageKey: 'app-theme' })
    expect(shown('mode')).toBe('dark')

    click('light')

    expect(localStorage.getItem('app-theme')).toBe('light')
    expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull()
  })

  it('still switches when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    stubPrefersDark(true)

    mount()
    expect(shown('mode')).toBe('system')

    click('light')

    expect(shown('mode')).toBe('light')
    expect(applied()).toBe('light')
  })
})

describe('useTheme', () => {
  it('throws outside a provider, naming what is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)
  })
})
