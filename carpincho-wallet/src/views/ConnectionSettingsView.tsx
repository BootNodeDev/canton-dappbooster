import { useEffect, useState } from 'react'
import { walletServiceRequest } from '@/api/walletService'
import { GhostButton, PrimaryButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import type { RuntimeConfig } from '@/config/runtimeConfig'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'

interface WalletServiceStatus {
  connection?: {
    isNetworkConnected?: boolean
    networkReason?: string
  }
  network?: {
    networkId?: string
  }
}

export const ConnectionSettingsView = (): JSX.Element => {
  const { config, saveConfig } = useRuntimeConfig()
  const [draft, setDraft] = useState<RuntimeConfig>(config)
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(config), [config])

  const onSave = (): void => {
    const saved = saveConfig(draft)
    setDraft(saved)
    toast.success('Saved.')
  }

  const onTest = async (): Promise<void> => {
    setBusy(true)
    try {
      const status = await walletServiceRequest<WalletServiceStatus>('status', undefined, {
        rpcUrl: draft.walletServiceRpcUrl,
      })
      const network = status.network?.networkId ?? 'unknown network'
      const connected = status.connection?.isNetworkConnected === true
      const reason = status.connection?.networkReason
      if (connected) {
        toast.success(`wallet-service reachable: ${network}`)
      } else {
        toast.warning(`wallet-service responded, Canton not connected: ${reason ?? network}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 pt-1">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="wallet-service-rpc">Wallet-service RPC URL</label>
          <GhostButton
            type="button"
            data-testid="rpc-test"
            onClick={() => {
              void onTest()
            }}
            disabled={busy}
            className="text-[0.82rem]"
          >
            {busy ? 'Testing…' : 'Test'}
          </GhostButton>
        </div>
        <TextInput
          id="wallet-service-rpc"
          data-testid="rpc-endpoint-input"
          type="url"
          className="font-mono"
          value={draft.walletServiceRpcUrl}
          onChange={(e) => setDraft((prev) => ({ ...prev, walletServiceRpcUrl: e.target.value }))}
          placeholder="http://localhost:3010/rpc"
        />
      </div>

      <PrimaryButton
        className="w-full mt-1"
        data-testid="rpc-save"
        onClick={onSave}
      >
        Save
      </PrimaryButton>
    </section>
  )
}
