import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible'

describe('Collapsible', () => {
  afterEach(cleanup)

  it('hides content until the trigger is activated', async () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden body</CollapsibleContent>
      </Collapsible>,
    )

    assert.equal(screen.queryByText('Hidden body'), null)
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))
    assert.ok(screen.getByText('Hidden body'))
  })
})
