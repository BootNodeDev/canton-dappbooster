// Which Canton network each half of the app is on. Both ids are read rather than configured, so
// either can be absent: an older factory row carries no `synchronizerId`, and the wallet-service
// read can fail. A missing half is not a mismatch, or a slow read would warn about nothing.

export type WrongNetwork = { app: string; wallet: string }

export const wrongNetwork = (
  wallet: string | undefined,
  app: string | undefined,
): WrongNetwork | undefined =>
  wallet === undefined || app === undefined || wallet === app ? undefined : { app, wallet }
