// The deployment the bootstrap script wrote. There is no fallback: without it the app has no
// package id and no factory to disclose, so nothing it does can reach the ledger.

export type Deployment = {
  pkg: string
  factoryCid: string
  factoryBlob: string
  synchronizerId?: string
}

const CONFIG_FILE = '/vesting-lite-parties.json'

// Typed against Deployment so renaming a field cannot leave this naming a key that is gone.
const REQUIRED: readonly (keyof Deployment)[] = ['pkg', 'factoryCid', 'factoryBlob']

const advice = (reason: string): Error =>
  new Error(`${CONFIG_FILE} ${reason} — run node scripts/bootstrap-vesting-lite.mjs`)

export const loadBackendConfig = async (): Promise<Deployment> => {
  const response = await fetch(CONFIG_FILE)
  if (!response.ok) {
    throw advice(`is missing (HTTP ${response.status})`)
  }
  // A dev server answers a missing file with the SPA fallback, so a 200 alone proves nothing.
  const body: unknown = await response.json().catch(() => undefined)
  if (typeof body !== 'object' || body === null) {
    throw advice('is not a JSON object')
  }
  const data = body as Partial<Deployment>
  const missing = REQUIRED.filter((key) => typeof data[key] !== 'string' || data[key] === '')
  if (missing.length > 0) {
    throw advice(`has no ${missing.join(', ')}`)
  }
  return data as Deployment
}
