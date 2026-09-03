import { Portal } from '@ark-ui/react/portal'
import { Toaster as ArkToaster } from '@ark-ui/react/toast'
import { ToastRow } from '@/components/Toaster/ToastRow'
import { toaster } from '@/utils/toast'

// Portalled so the region is a direct child of `<body>`, which is the whole reason it survives an
// open dialog: Ark aria-hides every body child outside the dialog and skips only those carrying
// `aria-live`, and it never descends into one it has hidden. Left inside `#root` the region would
// be announced by nobody, since `#root` is the child that gets hidden.
export const Toaster = (): React.JSX.Element => (
  <Portal>
    <ArkToaster toaster={toaster}>{(toast) => <ToastRow toast={toast} />}</ArkToaster>
  </Portal>
)
