import { Checkbox } from '@ark-ui/react/checkbox'
import { Steps } from '@ark-ui/react/steps'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import gatewayLogin from '@/assets/gateway-login.png'
import gatewayParties from '@/assets/gateway-parties.png'
import walletPicker from '@/assets/wallet-picker.png'
import { Button } from '@/components/Button'
import { CopyButton } from '@/components/CopyButton'
import { Modal } from '@/components/Modal'
import { StepBar } from '@/components/StepBar'
import { roundButtonClass } from '@/components/TopBar/ThemeToggle'
import { cn } from '@/utils/cn'
import { WALLET_GATEWAY_UI_URL } from '@/utils/config'

const HIDDEN_KEY = 'vesting.connectGuideHidden'

const isGuideHidden = (): boolean => {
  try {
    return localStorage.getItem(HIDDEN_KEY) !== null
  } catch {
    return true
  }
}

const markGuideHidden = (): void => {
  try {
    localStorage.setItem(HIDDEN_KEY, 'true')
  } catch {}
}

const gutterClass = 'size-9 shrink-0'

const chevronClass =
  `grid ${gutterClass} place-items-center rounded-full text-primary-strong transition-colors ` +
  'hover:bg-muted focus-visible:outline-none focus-visible:shadow-[var(--ring)]'

const steps = [
  {
    alt: 'The wallet picker with Wallet Gateway highlighted',
    image: walletPicker,
    name: 'Connect',
    text: (
      <>
        <b>Wallet Gateway</b> is available by default to be used as a wallet. To connect it, click
        the "Connect" button in the header and select <b>Wallet Gateway</b> from the options.
      </>
    ),
  },
  {
    alt: 'The Wallet Gateway login with the client secret field highlighted',
    image: gatewayLogin,
    name: 'Sign in',
    text: (
      <>
        Enter{' '}
        <span className="inline-flex items-center gap-1 font-mono text-[0.85em] font-semibold">
          <code>unsafe</code>
          <CopyButton label="Client secret" size={13} value="unsafe" />
        </span>{' '}
        as the client secret
      </>
    ),
  },
  {
    alt: 'The Wallet Gateway parties list with Set as primary highlighted',
    image: gatewayParties,
    name: 'Connected',
    text: (
      <>
        You're connected now. You can change the primary party to try different views in the dApp.
        Direct access to Wallet Gateway available{' '}
        <a
          aria-label="Open Wallet Gateway"
          className="font-semibold text-primary-strong underline underline-offset-3"
          href={WALLET_GATEWAY_UI_URL}
          rel="noreferrer"
          target="_blank"
        >
          here
        </a>
        .
      </>
    ),
  },
]

export const ConnectGuide = (): React.JSX.Element => {
  const [open, setOpen] = useState(() => !isGuideHidden())
  const [hideGuide, setHideGuide] = useState(false)
  const [showReminder, setShowReminder] = useState(false)
  const stepsRef = useRef<HTMLDivElement>(null)

  const close = (): void => {
    if (hideGuide) {
      markGuideHidden()
    }
    setShowReminder(hideGuide)
    setHideGuide(false)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        aria-label="How to connect a wallet"
        onClick={() => setOpen(true)}
        className={cn(roundButtonClass, 'text-[0.95rem] font-bold')}
      >
        ?
      </button>
      {open && (
        <Modal
          className="sm:max-w-lg"
          initialFocusEl={() => stepsRef.current}
          onClose={close}
          title="Welcome"
        >
          <Steps.Root className="outline-none" count={steps.length} ref={stepsRef} tabIndex={-1}>
            <StepBar navigable steps={steps.map(({ name }) => name)} />
            <Steps.Context>
              {(api) => (
                <div className="flex items-center gap-2">
                  {api.hasPrevStep ? (
                    <Steps.PrevTrigger aria-label="Previous step" className={chevronClass}>
                      <ChevronLeft size={28} strokeWidth={2.5} />
                    </Steps.PrevTrigger>
                  ) : (
                    <span aria-hidden="true" className={gutterClass} />
                  )}
                  <div className="min-w-0 flex-1">
                    {steps.map(({ alt, image, name }, index) => (
                      <img
                        alt={alt}
                        className="block w-full rounded-xl border border-border"
                        height={232}
                        hidden={index !== api.value}
                        key={name}
                        src={image}
                        width={400}
                      />
                    ))}
                  </div>
                  {api.value < api.count - 1 ? (
                    <Steps.NextTrigger aria-label="Next step" className={chevronClass}>
                      <ChevronRight size={28} strokeWidth={2.5} />
                    </Steps.NextTrigger>
                  ) : (
                    <span aria-hidden="true" className={gutterClass} />
                  )}
                </div>
              )}
            </Steps.Context>
            {steps.map(({ name, text }, index) => (
              <Steps.Content className="focus-visible:outline-none" index={index} key={name}>
                <p className="mt-4 text-[0.95rem] leading-6">{text}</p>
              </Steps.Content>
            ))}
          </Steps.Root>
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Checkbox.Root
              checked={hideGuide}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg-muted"
              onCheckedChange={({ checked }) => setHideGuide(checked === true)}
            >
              <Checkbox.Control className="grid size-4 place-items-center rounded-[4px] border border-border bg-surface text-primary-fg transition-colors data-[focus-visible]:shadow-[var(--ring)] data-[state=checked]:border-primary data-[state=checked]:bg-primary">
                <Checkbox.Indicator>
                  <Check size={12} strokeWidth={3} />
                </Checkbox.Indicator>
              </Checkbox.Control>
              <Checkbox.Label>Don't show again</Checkbox.Label>
              <Checkbox.HiddenInput />
            </Checkbox.Root>
            <Button className="ml-auto" size="sm" onClick={close}>
              Close
            </Button>
          </div>
        </Modal>
      )}
      {showReminder && (
        <Modal hideHeader onClose={() => setShowReminder(false)} title="Tutorial hidden">
          <p className="text-[0.95rem] leading-6">
            Click the{' '}
            <span
              aria-hidden="true"
              className="inline-grid size-6 place-items-center rounded-full border border-border bg-surface align-middle text-xs font-bold text-fg-muted"
            >
              ?
            </span>
            <span className="sr-only">How to connect a wallet</span> button in the header to open
            the tutorial again.
          </p>
          <div className="mt-6 flex">
            <Button className="ml-auto" size="sm" onClick={() => setShowReminder(false)}>
              Got it
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
