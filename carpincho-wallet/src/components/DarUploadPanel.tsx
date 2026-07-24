import { useState } from 'react'
import { type DarUploadResponse, uploadDarFile } from '@/api/walletService'
import { PrimaryButton } from '@/components/ui/Button'
import { FileDropInput } from '@/components/ui/FileDropInput'
import { toast } from '@/components/ui/toast'

export interface DarUploadApi {
  uploadDarFile: (file: File) => Promise<DarUploadResponse>
}

interface DarUploadPanelProps {
  api?: DarUploadApi
}

const defaultApi: DarUploadApi = { uploadDarFile }

// Development-only utility for uploading compiled DAML archives through wallet-service.
export const DarUploadPanel = ({ api = defaultApi }: DarUploadPanelProps): JSX.Element => {
  const [file, setFile] = useState<File | undefined>()
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>()

  // Keeps validation and toast feedback inside the dev-only upload utility.
  const onUpload = async (): Promise<void> => {
    if (file === undefined) {
      toast.warning('Select a DAR file')
      return
    }
    setUploading(true)
    setUploadedFileName(undefined)
    try {
      await api.uploadDarFile(file)
      setUploadedFileName(file.name)
      toast.success(`${file.name} uploaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <FileDropInput
        id="dar-file"
        testId="dar-file-input"
        accept=".dar,application/octet-stream"
        ariaLabel="DAR file"
        prompt="Click to choose a .dar file."
        fileName={file?.name ?? null}
        onSelect={(selected) => {
          setUploadedFileName(undefined)
          setFile(selected ?? undefined)
        }}
      />
      <PrimaryButton
        className="w-full"
        data-testid="dar-upload-submit"
        disabled={file === undefined || uploading}
        onClick={() => {
          void onUpload()
        }}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </PrimaryButton>
      {uploadedFileName === undefined ? null : (
        <p
          role="status"
          className="text-center text-[0.9rem] font-semibold text-success"
        >
          {uploadedFileName} uploaded
        </p>
      )}
    </section>
  )
}
