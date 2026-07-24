import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Copyable } from '@/components/ui/Copyable'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'

describe('Copyable', () => {
  const originalClipboard = globalThis.navigator?.clipboard

  afterEach(() => {
    cleanup()
    toast.clear()
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
  })

  it('writes the value to the clipboard and confirms the copy', async () => {
    const written: string[] = []
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: async (text: string) => void written.push(text) },
      configurable: true,
    })

    render(
      <TooltipProvider>
        <Copyable
          value="cid-1"
          label="contract ID"
        />
      </TooltipProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Copy contract ID' }))

    await waitFor(() => assert.deepEqual(written, ['cid-1']))
  })
})
