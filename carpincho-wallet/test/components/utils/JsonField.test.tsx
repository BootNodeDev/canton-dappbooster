import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { JsonField } from '@/components/utils/JsonField'

const Harness = (): JSX.Element => {
  const [value, setValue] = useState('{}')
  const [valid, setValid] = useState(true)
  return (
    <div>
      <span data-testid="valid">{valid ? 'valid' : 'invalid'}</span>
      <JsonField
        id="json-field"
        label="Create arguments JSON"
        value={value}
        onChange={setValue}
        onValidityChange={setValid}
      />
    </div>
  )
}

describe('JsonField', () => {
  afterEach(cleanup)

  it('flags invalid JSON and clears the flag when fixed', () => {
    render(<Harness />)
    const textarea = screen.getByLabelText('Create arguments JSON')

    fireEvent.change(textarea, { target: { value: '{ not json' } })
    assert.equal(screen.getByTestId('valid').textContent, 'invalid')
    assert.ok(screen.getByText(/invalid json/i))

    fireEvent.change(textarea, { target: { value: '{"a":1}' } })
    assert.equal(screen.getByTestId('valid').textContent, 'valid')
  })

  it('formats parseable input on blur', () => {
    render(<Harness />)
    const textarea = screen.getByLabelText('Create arguments JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{ a: 1 }' } })
    fireEvent.blur(textarea)
    assert.equal(textarea.value, JSON.stringify({ a: 1 }, null, 2))
  })
})
