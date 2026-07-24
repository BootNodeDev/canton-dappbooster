import { useState } from 'react'
import { PrimaryButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { JsonField } from '@/components/utils/JsonField'
import { UpdateIdResult } from '@/components/utils/UpdateIdResult'
import { createContract as defaultCreateContract } from '@/ledger/contracts'
import { parseJsonObject } from '@/utils/json'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

interface CreateContractUtilProps {
  account: AccountPublic
  createContract?: typeof defaultCreateContract
}

// Submits one generic CreateCommand and surfaces the resulting update id for copying.
export const CreateContractUtil = ({
  account,
  createContract = defaultCreateContract,
}: CreateContractUtilProps): JSX.Element => {
  const vault = useVault()
  const [templateId, setTemplateId] = useState('')
  const [json, setJson] = useState('{}')
  const [jsonValid, setJsonValid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [updateId, setUpdateId] = useState<string | undefined>()

  const canSubmit = templateId.trim() !== '' && jsonValid && !busy

  const onSubmit = async (): Promise<void> => {
    setBusy(true)
    setUpdateId(undefined)
    try {
      const createArguments = parseJsonObject(json, 'Create arguments')
      const result = await createContract({
        account,
        templateId: templateId.trim(),
        createArguments,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      setUpdateId(result.updateId)
      toast.success('Contract created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <label
        htmlFor="create-template-id"
        className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Template ID
        <TextInput
          id="create-template-id"
          data-testid="create-template-id"
          value={templateId}
          onChange={(event) => setTemplateId(event.currentTarget.value)}
          placeholder="package:Module:Template"
          className="font-mono text-[0.9rem] normal-case tracking-normal"
        />
      </label>
      <JsonField
        id="create-arguments-json"
        label="Create arguments JSON"
        value={json}
        onChange={setJson}
        onValidityChange={setJsonValid}
      />
      {updateId === undefined ? null : <UpdateIdResult updateId={updateId} />}
      <PrimaryButton
        type="submit"
        className="w-full"
        data-testid="create-contract-submit"
        disabled={!canSubmit}
      >
        {busy ? 'Creating...' : 'Create'}
      </PrimaryButton>
    </form>
  )
}
