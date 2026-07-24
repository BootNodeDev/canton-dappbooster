// Triggers a client-side file download of JSON. Secure-context only, matching the
// vault's crypto requirements; callers handle the thrown error with a toast.
export const downloadJson = (filename: string, data: unknown): void => {
  if (!window.isSecureContext) {
    throw new Error('Downloads require a secure context.')
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}
