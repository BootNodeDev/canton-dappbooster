import { toError } from '@bootnodedev/canton-connect'

export const errorText = (err: unknown): string => toError(err).message
