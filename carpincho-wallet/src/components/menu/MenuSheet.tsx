import { useEffect, useRef, useState } from 'react'
import { MenuList } from '@/components/menu/MenuList'
import { type Direction, MENU_LISTS, SCREENS, type Screen } from '@/components/menu/screens'
import { ThemeMenu } from '@/components/menu/ThemeMenu'
import { WalletConnectMenu } from '@/components/menu/WalletConnectMenu'
import { Sheet } from '@/components/ui/Sheet'
import { ExportVaultView, ImportVaultForm } from '@/components/VaultBackupPanel'
import { AutoLockList, PasswordForm } from '@/components/VaultPanel'
import { isExtensionRuntime } from '@/extension/runtimeClient'
import { useVault } from '@/vault/useVault'

interface MenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const MenuSheet = ({ open, onOpenChange }: MenuSheetProps): JSX.Element => {
  const v = useVault()
  const [screen, setScreen] = useState<Screen>('root')
  const [direction, setDirection] = useState<Direction>('forward')
  const screenRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every screen change to refocus the new view.
  useEffect(() => {
    if (!open) return
    const root = screenRef.current
    if (root === null) return
    const target = root.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    )
    target?.focus()
  }, [open, screen])

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      setScreen('root')
      setDirection('forward')
    }
    onOpenChange(next)
  }

  const goTo = (next: Screen): void => {
    setDirection('forward')
    setScreen(next)
  }

  const goBack = (): void => {
    const parent = SCREENS[screen].parent
    if (parent === null) {
      handleOpenChange(false)
      return
    }
    setDirection('back')
    setScreen(parent)
  }

  const onLogout = (): void => {
    v.lock()
    onOpenChange(false)
  }

  const config = SCREENS[screen]
  // WalletConnect URI pairing is web-only (inert in extension mode), so drop it from the drawer there.
  const list =
    screen === 'root' && isExtensionRuntime()
      ? MENU_LISTS.root?.filter((row) => row.to !== 'wallet-connect')
      : MENU_LISTS[screen]
  const animationClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      testId="menu-sheet"
      title={config.title}
      description={config.description}
      onBack={goBack}
      hideClose
      hideTitle={screen === 'root'}
      titleClassName="text-lg"
      side="right"
    >
      <div
        key={screen}
        ref={screenRef}
        className={animationClass}
      >
        {list !== undefined && (
          <MenuList
            rows={list}
            onNavigate={goTo}
            onLogout={onLogout}
          />
        )}
        {screen === 'wallet-connect' && (
          <WalletConnectMenu onPaired={() => handleOpenChange(false)} />
        )}
        {screen === 'theme' && <ThemeMenu />}
        {screen === 'password' && <PasswordForm />}
        {screen === 'auto-lock' && <AutoLockList />}
        {screen === 'export-vault' && (
          <ExportVaultView onExported={() => handleOpenChange(false)} />
        )}
        {screen === 'import-vault' && (
          <ImportVaultForm onImported={() => handleOpenChange(false)} />
        )}
      </div>
    </Sheet>
  )
}
