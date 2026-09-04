import { ConnectCancelledError, useConnect } from '@bootnodedev/canton-connect'
import { useEffect, useRef } from 'react'
import { errorText } from '@/utils/errorText'
import { toast } from '@/utils/toast'

/** False for a cancelled connect, which is a choice rather than a failure. */
export const isReportableConnectError = (error: Error): boolean =>
  !(error instanceof ConnectCancelledError)

export const useConnectErrorToast = (): void => {
  const { error } = useConnect()
  const reported = useRef<Error | undefined>(undefined)

  useEffect(() => {
    if (error === undefined || error === reported.current) {
      return
    }

    reported.current = error

    if (isReportableConnectError(error)) {
      toast.error(errorText(error))
    }
  }, [error])
}
