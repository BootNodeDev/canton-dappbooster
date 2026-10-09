import { Portal } from '@ark-ui/react/portal'
import { Toaster as ArkToaster } from '@ark-ui/react/toast'
import { ToastRow } from '@/components/Toaster/ToastRow'
import { toaster } from '@/utils/toast'

export const Toaster = (): React.JSX.Element => (
  <Portal>
    <ArkToaster toaster={toaster}>{(toast) => <ToastRow toast={toast} />}</ArkToaster>
  </Portal>
)
