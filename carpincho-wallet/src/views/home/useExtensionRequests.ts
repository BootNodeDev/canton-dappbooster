import { useCallback, useEffect, useRef } from 'react'
import { toast } from '@/components/ui/toast'
import type { RuntimePendingRequest } from '@/extension/messages'
import {
  createRuntimeResponder,
  getPendingProviderRequests,
  subscribeToPendingProviderRequests,
} from '@/extension/runtimeClient'
import type { ProviderRequestHandler } from '@/views/home/useProviderRequestHandler'

interface ExtensionRequestsArgs {
  extensionMode: boolean
  handleProviderRequest: ProviderRequestHandler
}

// Feeds extension pending requests through the shared handler, de-duplicating by
// request id so the initial drain and live subscription don't run one twice.
export const useExtensionRequests = ({
  extensionMode,
  handleProviderRequest,
}: ExtensionRequestsArgs): void => {
  const seenExtensionRequests = useRef<Set<string>>(new Set())

  const handleExtensionPending = useCallback(
    async (pending: RuntimePendingRequest): Promise<void> => {
      if (seenExtensionRequests.current.has(pending.requestId)) {
        return
      }
      seenExtensionRequests.current.add(pending.requestId)
      try {
        await handleProviderRequest(
          {
            method: pending.request.method,
            params: pending.request.params,
          },
          createRuntimeResponder(pending),
          { origin: pending.origin },
        )
      } catch (error) {
        console.error('[carpincho:extension] request handler failed', { pending, error })
        toast.error(`Extension request failed: ${(error as Error).message}`)
      }
    },
    [handleProviderRequest],
  )

  useEffect(() => {
    if (!extensionMode) {
      return
    }
    const unsubscribe = subscribeToPendingProviderRequests((pending) => {
      void handleExtensionPending(pending)
    })
    void getPendingProviderRequests()
      .then((pendingRequests) => {
        for (const pending of pendingRequests) {
          void handleExtensionPending(pending)
        }
      })
      .catch((err: Error) => toast.error(`Extension requests failed: ${err.message}`))
    return unsubscribe
  }, [extensionMode, handleExtensionPending])
}
