import { Steps } from '@ark-ui/react/steps'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import gatewayLogin from '@/assets/gateway-login.png'
import gatewayParties from '@/assets/gateway-parties.png'
import walletPicker from '@/assets/wallet-picker.png'
import { CopyButton } from '@/components/CopyButton'
import { Modal } from '@/components/Modal'
import { StepBar } from '@/components/StepBar'
import { cn } from '@/utils/cn'
import { WALLET_GATEWAY_UI_URL } from '@/utils/config'

const chevronClass =
  'grid size-9 shrink-0 place-items-center rounded-full text-primary-strong transition-colors ' +
  'hover:bg-muted focus-visible:outline-none focus-visible:shadow-[var(--ring)] disabled:invisible'

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

export const ConnectGuide = ({ onClose }: { onClose: () => void }): React.JSX.Element => {
  const stepsRef = useRef<HTMLDivElement>(null)

  return (
    <Modal
      className="sm:max-w-lg"
      initialFocusEl={() => stepsRef.current}
      onClose={onClose}
      title="Welcome"
    >
      <Steps.Root className="outline-none" count={steps.length} ref={stepsRef} tabIndex={-1}>
        <StepBar navigable steps={steps.map(({ name }) => name)} />
        <Steps.Context>
          {(api) => (
            <div className="flex items-center gap-2">
              <Steps.PrevTrigger aria-label="Previous step" className={chevronClass}>
                <ChevronLeft size={28} strokeWidth={2.5} />
              </Steps.PrevTrigger>
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
              <Steps.NextTrigger
                aria-label="Next step"
                className={cn(chevronClass, api.value === api.count - 1 && 'invisible')}
              >
                <ChevronRight size={28} strokeWidth={2.5} />
              </Steps.NextTrigger>
            </div>
          )}
        </Steps.Context>
        {steps.map(({ name, text }, index) => (
          <Steps.Content className="focus-visible:outline-none" index={index} key={name}>
            <p className="mt-4 text-[0.95rem] leading-6">{text}</p>
          </Steps.Content>
        ))}
      </Steps.Root>
    </Modal>
  )
}
