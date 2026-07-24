import { useState } from 'react'
import { Stepper } from '@/components/ui/Stepper'
import { WelcomeHero } from '@/components/WelcomeHero'
import { useVault } from '@/vault/useVault'
import { ConfigureRpcStep } from '@/views/onboarding/ConfigureRpcStep'
import { CreateFirstAccount } from '@/views/onboarding/CreateFirstAccount'
import { CreateVault } from '@/views/onboarding/CreateVault'

const ONBOARDING_STEPS = ['Vault', 'RPC', 'Account']

export const OnboardingFlow = (): JSX.Element => {
  const v = useVault()
  // In-memory gate: the RPC step re-shows on reload (no persisted onboarding state).
  const [rpcConfirmed, setRpcConfirmed] = useState(false)
  const step = !v.hasVault ? 1 : !rpcConfirmed ? 2 : 3

  return (
    <div>
      <WelcomeHero
        description="Canton development wallet."
        layout="compact"
      />
      <Stepper
        steps={ONBOARDING_STEPS}
        current={step}
      />
      <div
        key={step}
        className="animate-slide-up-and-fade [animation-fill-mode:backwards]"
      >
        {step === 1 && <CreateVault />}
        {step === 2 && <ConfigureRpcStep onConfirmed={() => setRpcConfirmed(true)} />}
        {step === 3 && <CreateFirstAccount />}
      </div>
    </div>
  )
}
