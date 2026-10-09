import { Steps } from '@ark-ui/react/steps'
import { useState } from 'react'
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

const SEEN_KEY = 'vesting.connectGuideSeen'

const hasSeenGuide = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) !== null
  } catch {
    return true
  }
}

const markGuideSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, 'true')
  } catch {}
}

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
  const [open, setOpen] = useState(() => !hasSeenGuide())

  const close = (): void => {
    markGuideSeen()
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
        <Modal onClose={close} title="Welcome">
          <Steps.Root count={steps.length}>
            <StepBar steps={steps.map(({ name }) => name)} />
            {steps.map(({ alt, image, name, text }, index) => (
              <Steps.Content className="focus-visible:outline-none" index={index} key={name}>
                <img
                  alt={alt}
                  className="block w-full rounded-xl border border-border"
                  height={232}
                  loading="lazy"
                  src={image}
                  width={400}
                />
                <p className="mt-4 text-[0.95rem] leading-6">{text}</p>
              </Steps.Content>
            ))}
            <Steps.Context>
              {(api) => (
                <div className="mt-6 flex items-center gap-3">
                  {api.hasPrevStep && (
                    <Steps.PrevTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-0">
                        Back
                      </Button>
                    </Steps.PrevTrigger>
                  )}
                  {api.value < api.count - 1 ? (
                    <Steps.NextTrigger asChild>
                      <Button className="ml-auto" size="sm">
                        Next
                      </Button>
                    </Steps.NextTrigger>
                  ) : (
                    <Button className="ml-auto" size="sm" onClick={close}>
                      Done
                    </Button>
                  )}
                </div>
              )}
            </Steps.Context>
          </Steps.Root>
        </Modal>
      )}
    </>
  )
}
