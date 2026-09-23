import { CantonError } from '@bootnodedev/canton-connect'

export const errorText = (err: unknown): string => {
  if (err instanceof CantonError) {
    return `${err.code}: ${err.message}`
  }

  return err instanceof Error ? err.message : String(err)
}
