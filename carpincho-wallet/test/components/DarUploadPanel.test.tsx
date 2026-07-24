import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DarUploadPanel } from '@/components/DarUploadPanel'
import { toast } from '@/components/ui/toast'

describe('DarUploadPanel', () => {
  afterEach(() => {
    // The panel owns transient upload state; cleanup resets the DOM between scenarios.
    cleanup()
    toast.clear()
  })

  it('uploads the selected DAR through the provided API', async () => {
    // Scenario: a developer selects one compiled DAR and submits it to the
    // validator-backed wallet-service admin endpoint.
    const selectedFile = new File(['dar-bytes'], 'token.dar')
    let uploaded: File | undefined

    render(
      <DarUploadPanel
        api={{
          uploadDarFile: async (file) => {
            uploaded = file
            return { ok: true, vetAllPackages: true, response: {} }
          },
        }}
      />,
    )

    await userEvent.upload(screen.getByLabelText('DAR file'), selectedFile)
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }))

    // The exact selected file object is passed through, preserving binary contents and filename.
    assert.equal(uploaded, selectedFile)
    await screen.findByText('token.dar uploaded')
  })
})
