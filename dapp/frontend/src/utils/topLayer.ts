import { create } from 'zustand'

interface TopLayerState {
  host: HTMLElement | null
}

const useTopLayerStore = create<TopLayerState>(() => ({ host: null }))

// A native modal dialog inerts everything outside its own subtree, so an overlay that has to stay
// live over one renders into the open dialog rather than at the end of the body.
export const useTopLayerHost = (): HTMLElement | null => useTopLayerStore((s) => s.host)

export const setTopLayerHost = (host: HTMLElement | null): void =>
  useTopLayerStore.setState({ host })
