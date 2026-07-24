import { useState } from 'react'
import { DarUploadPanel } from '@/components/DarUploadPanel'
import { Alert } from '@/components/ui/Alert'
import { Sheet } from '@/components/ui/Sheet'
import { ActiveContractsUtil } from '@/components/utils/ActiveContractsUtil'
import { CreateContractUtil } from '@/components/utils/CreateContractUtil'
import { ExerciseChoiceUtil } from '@/components/utils/ExerciseChoiceUtil'
import { type UtilKey, UtilsList } from '@/components/utils/UtilsList'
import { createContract, exerciseContract, listActiveContracts } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'

export interface UtilsApi {
  createContract: typeof createContract
  exerciseContract: typeof exerciseContract
  listActiveContracts: typeof listActiveContracts
}

const defaultApi: UtilsApi = { createContract, exerciseContract, listActiveContracts }

const UTIL_TITLES: Record<UtilKey, string> = {
  create: 'Create contract',
  exercise: 'Exercise choice',
  contracts: 'Active contracts',
  dar: 'Upload DAR',
}

interface UtilsPanelProps {
  account?: AccountPublic
  api?: UtilsApi
}

// Dev tools: a util list where selecting a util opens it in a modal.
export const UtilsPanel = ({ account, api = defaultApi }: UtilsPanelProps): JSX.Element => {
  const [selected, setSelected] = useState<UtilKey | null>(null)

  if (account === undefined) {
    return (
      <section className="px-1 pt-3 pb-2">
        <Alert variant="warning">Create an account before using ledger tools.</Alert>
      </section>
    )
  }

  return (
    <>
      <UtilsList
        account={account}
        onSelect={setSelected}
      />
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        testId="utils-sheet"
        title={selected === null ? '' : UTIL_TITLES[selected]}
        description="Ledger development tool."
        side="center"
      >
        {selected === 'create' && (
          <CreateContractUtil
            account={account}
            createContract={api.createContract}
          />
        )}
        {selected === 'exercise' && (
          <ExerciseChoiceUtil
            account={account}
            exerciseContract={api.exerciseContract}
          />
        )}
        {selected === 'contracts' && (
          <ActiveContractsUtil
            account={account}
            listActiveContracts={api.listActiveContracts}
          />
        )}
        {selected === 'dar' && <DarUploadPanel />}
      </Sheet>
    </>
  )
}
