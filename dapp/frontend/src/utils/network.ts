// A participant can be connected to several synchronizers, so the wallet's side is a list and the
// rule is membership rather than equality: the app's network being one of them is what lets a write
// reach it. Either side can be missing, since both are read rather than configured, and a missing
// side is not a mismatch — the strip would warn about a read that has simply not landed.

export type WrongNetwork = { app: string; wallet: string }

export const wrongNetwork = (
  wallet: readonly string[],
  app: string | undefined,
): WrongNetwork | undefined => {
  const submitsTo = wallet[0]
  return app === undefined || submitsTo === undefined || wallet.includes(app)
    ? undefined
    : { app, wallet: submitsTo }
}
