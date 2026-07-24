import { type FormEvent, useState } from 'react'
import { ConfirmPasswordForm } from '@/components/ConfirmPasswordForm'
import { PrimaryButton } from '@/components/ui/Button'
import { FileDropInput } from '@/components/ui/FileDropInput'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { toast } from '@/components/ui/toast'
import { downloadJson } from '@/utils/download'
import { useVault } from '@/vault/useVault'

const backupFilename = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `carpincho-backup-${stamp}.json`
}

interface ExportVaultViewProps {
  onExported?: () => void
}

// Confirms the vault password, encrypts a backup of every account under it, and downloads
// the file directly. The encrypted container never lands in React state and is never logged.
export const ExportVaultView = ({ onExported }: ExportVaultViewProps): JSX.Element => {
  const v = useVault()

  const exportBackup = async (password: string): Promise<void> => {
    try {
      const backup = await v.exportEncryptedVault(password)
      downloadJson(backupFilename(), backup)
      toast.success('Encrypted backup downloaded.')
      onExported?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  return (
    <ConfirmPasswordForm
      label="Confirm password"
      submitLabel="Export"
      passwordTestId="vault-export-password"
      submitTestId="vault-export-submit"
      onVerified={(password) => void exportBackup(password)}
    >
      <p className="text-[0.85rem] text-muted-foreground">
        The current vault's password will be used to encrypt the exported file. You'll need it to
        import the accounts, so make sure not to lose or forget it.
      </p>
    </ConfirmPasswordForm>
  )
}

interface ImportVaultFormProps {
  onImported?: () => void
}

// Restores accounts from an encrypted backup file. Decryption (with the file's password)
// is the gate; the per-entry validation inside importEncryptedVault is defense-in-depth.
export const ImportVaultForm = ({ onImported }: ImportVaultFormProps): JSX.Element => {
  const v = useVault()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (file === null) {
      toast.warning('Choose a backup file.')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      toast.error('Invalid file.')
      return
    }
    setBusy(true)
    try {
      const r = await v.importEncryptedVault(parsed, password)
      toast.success(`Imported ${r.imported}, skipped ${r.skipped}, rejected ${r.rejected}.`)
      // Only leave the screen when something landed; otherwise stay so the counts remain readable.
      if (r.imported > 0) {
        onImported?.()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <FileDropInput
        id="import-vault-file"
        testId="vault-import-file"
        accept=".json,application/json"
        ariaLabel="Backup file"
        prompt="Click to choose a .json backup."
        fileName={file?.name ?? null}
        onSelect={setFile}
      />
      <div>
        <label htmlFor="import-vault-password">Backup password</label>
        <PasswordInput
          id="import-vault-password"
          data-testid="vault-import-password"
          autoComplete="off"
          placeholder="Backup password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">
          Enter the password you used when you exported this file.
        </p>
      </div>
      <PrimaryButton
        type="submit"
        data-testid="vault-import-submit"
        disabled={busy || file === null || password === ''}
      >
        {busy ? 'Importing...' : 'Import'}
      </PrimaryButton>
    </form>
  )
}
