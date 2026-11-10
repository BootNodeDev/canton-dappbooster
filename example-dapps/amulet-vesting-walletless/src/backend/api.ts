export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const expiryListeners = new Set<() => void>()

export const onSessionExpired = (listener: () => void): (() => void) => {
  expiryListeners.add(listener)
  return () => {
    expiryListeners.delete(listener)
  }
}

export const api = async <T>(
  path: string,
  { body, method = 'GET' }: { body?: unknown; method?: 'GET' | 'POST' } = {},
): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    // The server takes no write that is not JSON, which is what keeps a cross-site form out.
    ...(method === 'GET'
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  }).catch((error: unknown) => {
    throw new ApiError(`The server is unreachable: ${String(error)}`, 0)
  })
  const payload = (await response.json().catch(() => undefined)) as { error?: unknown } | undefined
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      for (const listener of expiryListeners) listener()
    }
    const message =
      typeof payload?.error === 'string' ? payload.error : `The server answered ${response.status}`
    throw new ApiError(message, response.status)
  }
  return payload as T
}
