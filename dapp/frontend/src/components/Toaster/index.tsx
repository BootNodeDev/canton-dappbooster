import { createPortal } from 'react-dom'
import { ToastRow } from '@/components/Toaster/ToastRow'
import { useToastStore } from '@/utils/toast'
import { useTopLayerHost } from '@/utils/topLayer'

export const Toaster = (): React.JSX.Element => {
  const toasts = useToastStore((s) => s.toasts)
  const host = useTopLayerHost()
  const viewport = (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-80 flex-col gap-2.5"
    >
      {toasts.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  )
  // An open modal dialog inerts the rest of the document, so a toast raised over one (every failed
  // submit) is only dismissable and only announced from inside it.
  return host === null ? viewport : createPortal(viewport, host)
}
