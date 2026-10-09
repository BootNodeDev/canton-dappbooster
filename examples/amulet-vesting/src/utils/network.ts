export type NetworkStatus = 'ok' | 'unknown' | 'wrong'

export const networkStatus = (
  wallet: readonly string[],
  app: string | undefined,
): NetworkStatus => {
  if (app === undefined || wallet.length === 0) {
    return 'unknown'
  }
  return wallet.includes(app) ? 'ok' : 'wrong'
}

export const networkLabel = (networkId: string): string =>
  networkId.slice(networkId.indexOf(':') + 1) || networkId
