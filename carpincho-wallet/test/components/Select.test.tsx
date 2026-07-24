import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Select } from '@/components/ui/Select'

const OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
]

describe('Select', () => {
  afterEach(() => cleanup())

  it('renders the selected option label on the trigger', () => {
    render(
      <Select
        ariaLabel="Deadline"
        value="1d"
        onValueChange={() => undefined}
        options={OPTIONS}
      />,
    )
    const trigger = screen.getByLabelText('Deadline')
    assert.equal(trigger.textContent?.includes('1 day'), true)
  })
})
