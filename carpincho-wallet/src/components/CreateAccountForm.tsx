import { useState } from 'react'
import {
  completeCreateParty,
  getWalletServiceNetworkId,
  prepareCreateParty,
} from '@/api/walletService'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { cn } from '@/utils/cn'
import { generateKeypair, signMessageBase64 } from '@/vault/keypair'
import { useVault } from '@/vault/useVault'

export interface CreateAccountFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  submitLabel?: string
  showIntro?: boolean
}

const HINT_PATTERN = /^[a-z0-9._-]{3,64}$/

export const CreateAccountForm = ({
  onSuccess,
  onCancel,
  submitLabel = 'Create account',
  showIntro = false,
}: CreateAccountFormProps): JSX.Element => {
  const v = useVault()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim().toLowerCase()
  const isValid = HINT_PATTERN.test(trimmed)
  const showError = name.trim() !== '' && !isValid

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!isValid) {
      return
    }
    setBusy(true)
    try {
      const kp = await generateKeypair()
      const prepared = await prepareCreateParty({
        publicKeyBase64: kp.publicKeyBase64,
        partyHint: trimmed,
      })
      const signatureBase64 = await signMessageBase64(kp.privateKeyHex, prepared.multiHash)
      const completed = await completeCreateParty({
        onboardingId: prepared.onboardingId,
        signatureBase64,
      })
      const networkId = await getWalletServiceNetworkId()
      await v.addAccount({
        name: trimmed,
        partyId: completed.partyId,
        network: networkId,
        privateKeyHex: kp.privateKeyHex,
        publicKeyBase64: kp.publicKeyBase64,
      })
      onSuccess?.()
    } catch (err) {
      toast.error(`Create account failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const standalone = onCancel === undefined

  return (
    <div>
      {showIntro && (
        <p className="text-soft text-[1rem] mb-5 leading-relaxed">
          You need at least one account to start using the wallet.
        </p>
      )}
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <div>
          <label
            htmlFor="acct-name"
            className="flex gap-1"
          >
            Username
            <Tooltip
              content={
                <>This will become the "party hint": the prefix of your on-ledger Canton party ID</>
              }
              label="Username / party hint"
            />
          </label>
          <TextInput
            id="acct-name"
            type="text"
            className="font-mono"
            data-testid="add-account-hint-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="alice"
            maxLength={64}
            error={showError}
            aria-describedby="acct-name-hint"
          />
          <p
            id="acct-name-hint"
            className={cn(
              'mt-1.5 text-[0.8rem] leading-relaxed',
              showError ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            Use 3-64 lowercase letters, digits, dot, dash, or underscore.
          </p>
        </div>
        <div className={standalone ? 'mt-6' : 'mt-1 flex gap-3'}>
          <PrimaryButton
            type="submit"
            className={standalone ? 'w-full' : undefined}
            data-testid="add-account-submit"
            disabled={busy || !isValid}
          >
            {busy ? 'Creating…' : submitLabel}
          </PrimaryButton>
          {onCancel !== undefined && (
            <SecondaryButton
              onClick={onCancel}
              data-testid="add-account-cancel"
              disabled={busy}
            >
              Cancel
            </SecondaryButton>
          )}
        </div>
      </form>
    </div>
  )
}
