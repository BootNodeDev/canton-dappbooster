import type { ReactNode } from 'react'
import { WALLET_CONNECT_ICON } from '@/components/ui/icons'

export type Screen =
  | 'root'
  | 'wallet-connect'
  | 'theme'
  | 'vault'
  | 'password'
  | 'auto-lock'
  | 'export-vault'
  | 'import-vault'
export type Direction = 'forward' | 'back'

interface ScreenConfig {
  title: string
  description: string
  parent: Screen | null
}

export const SCREENS: Record<Screen, ScreenConfig> = {
  root: {
    title: 'Menu',
    description: 'Wallet menu.',
    parent: null,
  },
  'wallet-connect': {
    title: 'WalletConnect',
    description: 'Paste a WalletConnect URI to connect a dApp.',
    parent: 'root',
  },
  theme: {
    title: 'Theme',
    description: 'Choose light, dark, or follow the system setting.',
    parent: 'root',
  },
  vault: {
    title: 'Vault',
    description: 'Password, auto-lock, and account backup.',
    parent: 'root',
  },
  password: {
    title: 'Password',
    description: 'Set a new password for this vault.',
    parent: 'vault',
  },
  'auto-lock': {
    title: 'Auto-lock',
    description: 'Choose how long the wallet stays unlocked while idle.',
    parent: 'vault',
  },
  'export-vault': {
    title: 'Export Vault',
    description: 'Download an encrypted backup of every account in this vault.',
    parent: 'vault',
  },
  'import-vault': {
    title: 'Import Vault',
    description: 'Restore accounts from an encrypted backup file.',
    parent: 'vault',
  },
}

export interface MenuListRow {
  label: string
  to: Screen | 'logout'
  tone?: 'danger'
  icon?: ReactNode
}

// Leaf screens (theme, password, auto-lock, export-vault, import-vault) render
// dedicated components and are absent here.
export const MENU_LISTS: Partial<Record<Screen, MenuListRow[]>> = {
  root: [
    { label: 'WalletConnect', to: 'wallet-connect', icon: WALLET_CONNECT_ICON },
    { label: 'Theme', to: 'theme' },
    { label: 'Vault', to: 'vault' },
    { label: 'Log out', to: 'logout', tone: 'danger' },
  ],
  vault: [
    { label: 'Password', to: 'password' },
    { label: 'Auto Lock', to: 'auto-lock' },
    { label: 'Export Vault', to: 'export-vault' },
    { label: 'Import Vault', to: 'import-vault' },
  ],
}
