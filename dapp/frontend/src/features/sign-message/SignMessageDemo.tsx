import { useSignMessage } from 'canton-connect-kit'
import type { JSX } from 'react'
import { useState } from 'react'
import { SecondaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { errorMessage } from '../../utils/errorMessage'
import { shortenIdentifier } from '../../utils/formatPartyId'

// Standalone CIP-0103 signMessage example. Not part of the Stampbook app and
// not linked from its UI; reachable only at /sign-demo (App.tsx routes by path)
// and driven there by its e2e. Parked for a future examples page like
// https://demo.dappbooster.dev/.
export const SignMessageDemo = (): JSX.Element => {
  const { signMessage, signature, isSigning } = useSignMessage()
  const [signInput, setSignInput] = useState<string>('hello canton')

  const onSignMessage = async (): Promise<void> => {
    try {
      await signMessage(signInput)
      toast.success('Message signed.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <section data-testid="signing-panel">
      <div className="mb-4">
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Wallet capability
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">Sign message</h2>
      </div>
      <Card className="flex flex-col gap-3">
        <p className="m-0 text-sm text-muted-foreground">
          Exercises CIP-0103 <code className="font-mono text-foreground">signMessage</code> against
          the connected wallet. The wallet asks for approval, signs with the active party's key, and
          returns the Ed25519 signature in base64.
        </p>
        <TextInput
          data-testid="sign-input"
          value={signInput}
          onChange={(event) => setSignInput(event.target.value)}
          placeholder="Message to sign"
          disabled={isSigning}
        />
        <SecondaryButton
          data-testid="sign-message"
          onClick={() => {
            void onSignMessage()
          }}
          disabled={isSigning}
        >
          {isSigning ? 'Signing…' : 'Sign with active party'}
        </SecondaryButton>
        {signature !== undefined && (
          <div
            data-testid="signature-output"
            data-signature={signature}
            className="flex flex-col gap-1"
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Signature (base64)
            </span>
            <code className="break-all rounded-lg bg-muted p-2 font-mono text-xs text-foreground">
              {shortenIdentifier(signature)}
            </code>
          </div>
        )}
      </Card>
    </section>
  )
}
