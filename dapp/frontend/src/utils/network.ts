// A participant can be connected to several synchronizers, so the wallet's side is a list and the
// rule is membership rather than equality: the app's network being one of them is what lets a write
// reach it. Either side can be missing, since both are read rather than configured, and a missing
// side is not a mismatch — the strip would warn about a read that has not landed.

// A verdict and not the ids behind it, because nothing can name the app's network to a reader:
// wallet-service's label and the wallet's are typed by hand and by different people, so they can
// read the same for two networks or differently for one. The synchronizer ids decide this; only the
// wallet's own label is fit to show.
export const wrongNetwork = (wallet: readonly string[], app: string | undefined): boolean =>
  app !== undefined && wallet.length > 0 && !wallet.includes(app)

// CAIP-2 is `namespace:reference`, and the namespace is `canton` for every network this app can be
// pointed at, so it tells a reader nothing. Anything without one is shown whole.
export const networkLabel = (networkId: string): string => {
  const reference = networkId.slice(networkId.indexOf(':') + 1)
  return reference === '' ? networkId : reference
}
