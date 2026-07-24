// Strips the `canton:` synchronizer prefix for display.
export const displayNetworkId = (networkId?: string): string | undefined =>
  networkId?.replace(/^canton:/, '')
