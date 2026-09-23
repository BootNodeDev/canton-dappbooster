// Bounds a remote message, so a proxy answering with an HTML page cannot fill a toast.
const MESSAGE_CHARS = 200

/**
 * The participant's error payload, as the Canton JSON Ledger API sends it and the Wallet Gateway
 * forwards it under the JSON-RPC envelope's `data`.
 *
 * @example
 * const payload = cantonErrorPayloadOf(error)
 * payload?.definiteAnswer === false // the submission may still have committed
 *
 * @category Types
 */
// Declared, not imported: the spec ships only gateway-side. See architecture.md.
export interface CantonErrorPayload {
  code: string
  cause: string
  errorCategory: number
  context?: Record<string, string>
  correlationId?: string | null
  traceId?: string | null
  grpcCodeValue?: number | null
  retryInfo?: string | null
  definiteAnswer?: boolean | null
}

/**
 * A rejection the participant itself raised, told apart from one the wallet or the gateway raised.
 * `code` is Canton's own name for the failure, and the untouched payload stays on `payload`.
 *
 * @example
 * try {
 *   await execute({ commands })
 * } catch (err) {
 *   if (err instanceof CantonError) toast.error(`${err.code}: ${err.message}`)
 * }
 *
 * @category Errors
 */
export class CantonError extends Error {
  readonly code: string
  readonly errorCategory: number
  readonly retryInfo: string | undefined
  readonly definiteAnswer: boolean | undefined
  readonly traceId: string | undefined
  readonly payload: CantonErrorPayload

  constructor(payload: CantonErrorPayload, cause?: unknown) {
    super(payload.cause, { cause })
    this.name = 'CantonError'
    this.code = payload.code
    this.errorCategory = payload.errorCategory
    this.retryInfo = payload.retryInfo ?? undefined
    this.definiteAnswer = payload.definiteAnswer ?? undefined
    this.traceId = payload.traceId ?? undefined
    this.payload = payload
  }
}

const memberOf = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined

const textOf = (value: unknown, key: string): string | undefined => {
  const found = memberOf(value, key)

  return typeof found === 'string' && found !== '' ? found : undefined
}

// The three fields the gateway's own guard requires before it wraps a rejection as a Canton one.
const isCantonErrorPayload = (value: unknown): value is CantonErrorPayload =>
  typeof memberOf(value, 'code') === 'string' &&
  typeof memberOf(value, 'cause') === 'string' &&
  typeof memberOf(value, 'errorCategory') === 'number'

/**
 * Finds the participant's payload in whatever a wallet rejected with, envelope or not.
 *
 * @example
 * cantonErrorPayloadOf(error)?.code // 'CONTRACT_NOT_FOUND'
 *
 * @category Utilities
 */
export const cantonErrorPayloadOf = (cause: unknown): CantonErrorPayload | undefined => {
  const envelope = memberOf(cause, 'error')

  for (const candidate of [cause, memberOf(cause, 'data'), memberOf(envelope, 'data')]) {
    if (isCantonErrorPayload(candidate)) {
      return candidate
    }
  }

  return undefined
}

/**
 * Whether Canton itself said the submission may be sent again; anything else is false, a failed
 * command included.
 *
 * @example
 * if (isRetryable(error)) await execute({ commands })
 *
 * @category Utilities
 */
export const isRetryable = (error: unknown): boolean =>
  error instanceof CantonError && typeof error.retryInfo === 'string' && error.retryInfo !== ''

const bounded = (text: string): string =>
  text.length <= MESSAGE_CHARS ? text : `${text.slice(0, MESSAGE_CHARS - 1)}…`

// One key per transport, in the order architecture.md lists them.
export const messageOf = (cause: unknown): string | undefined => {
  const text =
    textOf(cause, 'message') ??
    textOf(cause, 'details') ??
    textOf(memberOf(cause, 'error'), 'message')

  return text === undefined ? undefined : bounded(text)
}
