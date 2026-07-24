import { toast } from '@/components/ui/toast'

// Copies arbitrary wallet text while keeping success and failure feedback consistent.
export const copyText = (value: string, successMessage: string, onSuccess?: () => void): void => {
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      toast.success(successMessage)
      onSuccess?.()
    })
    .catch((err: Error) => toast.error(`Copy failed: ${err.message}`))
}
