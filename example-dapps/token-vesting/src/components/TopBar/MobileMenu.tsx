import { Dialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { useTheme } from '@bootnodedev/canton-dappbooster'
import { CircleHelp, Menu, X } from 'lucide-react'
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'
import { NavLink, type To } from 'react-router-dom'
import { Pills } from '@/components/Pills'
import { NavCount } from '@/components/TopBar/NavCount'
import { cn } from '@/utils/cn'

export interface MenuLink {
  count?: number
  label: string
  to: To
}

interface MobileMenuProps {
  account?: (close: () => void) => ReactNode
  action: (close: () => void) => ReactNode
  help?: { label: string; open: () => void }
  links: readonly MenuLink[]
}

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

// Past this drag distance (px) or speed (px/s) downward, letting go closes the sheet.
const CLOSE_AT = 80
const CLOSE_SPEED = 500

interface Drag {
  last: number
  moved: boolean
  speed: number
  time: number
  y: number
}

const rowClass =
  'flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm font-semibold text-fg-muted'

// A sheet taller than the screen scrolls, so only its grip drags it; `touch-action` follows.
const watchOverflow = (sheet: HTMLDivElement | null): (() => void) | undefined => {
  if (sheet === null) {
    return undefined
  }
  const measure = (): void => {
    sheet.dataset.scrollable = String(sheet.scrollHeight > sheet.clientHeight)
  }
  const observer = new ResizeObserver(measure)
  observer.observe(sheet)
  return () => observer.disconnect()
}

export const MobileMenu = ({
  account,
  action,
  help,
  links,
}: MobileMenuProps): React.JSX.Element => {
  const [open, setOpen] = useState(false)
  const { mode, setMode } = useTheme()
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const attach = useCallback((sheet: HTMLDivElement | null) => {
    sheetRef.current = sheet
    return watchOverflow(sheet)
  }, [])

  // A drag leaves `animation: none` inline, which would otherwise outrank the leave animation.
  const close = (): void => {
    sheetRef.current?.style.removeProperty('animation')
    setOpen(false)
  }

  const settle = (sheet: HTMLDivElement): void => {
    sheet.style.transition = 'transform 940ms var(--ease-settle)'
    sheet.style.transform = ''
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const sheet = event.currentTarget
    const fromGrip = event.target instanceof Element && event.target.closest('[data-grip]') !== null
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (sheet.dataset.scrollable === 'true' && !fromGrip)
    ) {
      return
    }
    drag.current = {
      last: event.clientY,
      moved: false,
      speed: 0,
      time: event.timeStamp,
      y: event.clientY,
    }
  }

  // The sheet follows the finger: freely down at 60% of the pointer's travel, barely up (5%).
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    if (current === null) {
      return
    }
    const sheet = event.currentTarget
    const offset = event.clientY - current.y
    if (!current.moved) {
      if (Math.abs(offset) < 4) {
        return
      }
      current.moved = true
      sheet.setPointerCapture(event.pointerId)
      sheet.style.animation = 'none'
      sheet.style.transition = 'none'
    }
    const elapsed = event.timeStamp - current.time
    if (elapsed > 0) {
      current.speed = ((event.clientY - current.last) / elapsed) * 1000
    }
    current.last = event.clientY
    current.time = event.timeStamp
    sheet.style.transform = `translateY(${offset * (offset > 0 ? 0.6 : 0.05)}px)`
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    drag.current = null
    if (current === null || !current.moved) {
      return
    }
    if (event.clientY - current.y > CLOSE_AT || current.speed > CLOSE_SPEED) {
      close()
      return
    }
    settle(event.currentTarget)
  }

  // The browser took the gesture over, so nobody let go: put the sheet back.
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>): void => {
    const moved = drag.current?.moved === true
    drag.current = null
    if (moved) {
      settle(event.currentTarget)
    }
  }

  return (
    <Dialog.Root
      lazyMount
      onOpenChange={(details) => (details.open ? setOpen(true) : close())}
      open={open}
      unmountOnExit
    >
      <Dialog.Trigger
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="grid size-10 place-items-center rounded-full text-fg md:hidden"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop className="sheet-backdrop fixed inset-0 z-20 md:hidden" />
        <Dialog.Positioner className="fixed inset-x-3 bottom-3 z-40 md:hidden">
          <Dialog.Content
            className="sheet max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-[calc(var(--radius-card)*2)] border border-border px-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none"
            onPointerCancel={onPointerCancel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            ref={attach}
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <div className="pt-2 pb-2" data-grip>
              <Dialog.CloseTrigger
                aria-label="Close menu"
                className="mx-auto block h-6 w-16 before:mx-auto before:block before:h-1 before:w-10 before:rounded-full before:bg-border-strong before:content-['']"
              />
            </div>
            {account?.(close)}
            <nav aria-label="Menu">
              <ul className="flex flex-col gap-0.5">
                {links.map((link, index) => (
                  <li key={link.label} style={{ '--i': index } as CSSProperties}>
                    <NavLink
                      className="sheet-link flex items-center gap-3 rounded-control px-4 py-3.5 font-heading text-[1.35rem] font-bold text-fg aria-[current=page]:bg-surface-2"
                      end
                      onClick={close}
                      to={link.to}
                    >
                      {link.label}
                      <span className="flex-1" />
                      {link.count !== undefined && link.count > 0 && (
                        <NavCount count={link.count} />
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-2">
              {help !== undefined && (
                <button
                  className={cn(rowClass, 'w-full text-left')}
                  onClick={() => {
                    close()
                    help.open()
                  }}
                  type="button"
                >
                  <span className="flex items-center gap-2.5">
                    <CircleHelp size={18} />
                    {help.label}
                  </span>
                </button>
              )}
              <div className={rowClass}>
                <span>Theme</span>
                <Pills
                  label="Theme"
                  onChange={setMode}
                  options={THEMES}
                  value={mode}
                  variant="segmented"
                />
              </div>
            </div>
            <div className="mt-3">{action(close)}</div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
