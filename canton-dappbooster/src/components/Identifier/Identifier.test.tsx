import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubClipboard } from '../../testing/clipboard'
import { Identifier } from '.'
import { anatomy } from './anatomy'
import { truncateIdentifier } from './truncate'

const PARTY = 'nico::1220df946c5b01ad0f2d2b480f1f43b1d1f2e498f5a49c2f0b1cbb46'
const SHORT = 'cid-abc'

const part = (name: keyof typeof anatomy.parts): Element | null =>
  document.querySelector(`.${anatomy.parts[name]}`)

afterEach(() => {
  stubClipboard(undefined)
})

describe('Identifier', () => {
  // Delegation, not truncation: the output itself is pinned in truncate.test.ts.
  it('renders the root and value parts, truncated', () => {
    render(<Identifier value={PARTY} />)
    expect(part('root')).toBeInTheDocument()
    expect(part('value')).toHaveTextContent(truncateIdentifier(PARTY))
  })

  it('appends a consumer class to the root part', () => {
    render(<Identifier value={PARTY} className="extra" />)
    expect(part('root')).toHaveClass(anatomy.parts.root, 'extra')
  })

  it('exposes the full value through title, truncated or not', () => {
    const { unmount } = render(<Identifier value={PARTY} />)
    expect(part('value')).toHaveAttribute('title', PARTY)
    unmount()

    render(<Identifier value={SHORT} />)
    expect(part('value')).toHaveAttribute('title', SHORT)
  })

  it('forwards unknown props to the root part', () => {
    render(<Identifier value={PARTY} data-testid="acting-party" />)
    expect(part('root')).toHaveAttribute('data-testid', 'acting-party')
  })

  it('renders the value whole when truncation is off', () => {
    render(<Identifier value={PARTY} truncate={false} />)
    expect(part('value')).toHaveTextContent(PARTY)
  })

  it('honours truncation overrides', () => {
    render(<Identifier value={PARTY} truncate={{ head: 4, tail: 4 }} />)
    expect(part('value')).toHaveTextContent(truncateIdentifier(PARTY, { head: 4, tail: 4 }))
  })

  it('leaves the untouched knobs at their defaults when given a partial override', () => {
    render(<Identifier value={PARTY} truncate={{ head: 4 }} />)
    expect(part('value')).toHaveTextContent(truncateIdentifier(PARTY, { head: 4 }))
    expect(part('value')).not.toHaveTextContent(truncateIdentifier(PARTY))
  })

  it('labels the copy control with the supplied noun', () => {
    render(<Identifier value={PARTY} label="party id" />)
    expect(screen.getByRole('button', { name: 'Copy party id' })).toBeInTheDocument()
  })

  it('omits the copy control and its live region when copy is off', () => {
    render(<Identifier value={PARTY} copy={false} />)
    expect(part('copy')).not.toBeInTheDocument()
    expect(part('status')).not.toBeInTheDocument()
  })

  it('mounts an empty live region so the outcome can be announced', () => {
    render(<Identifier value={PARTY} />)
    expect(part('status')).toHaveAttribute('role', 'status')
    expect(part('status')).toHaveTextContent('')
    // Hidden by the component, not the theme, so a themeless consumer never sees the text.
    expect(part('status')).toHaveStyle({ position: 'absolute', clipPath: 'inset(50%)' })
  })

  it('omits the live region when the consumer announces the outcome itself', () => {
    render(<Identifier value={PARTY} announce={false} />)
    expect(part('copy')).toBeInTheDocument()
    expect(part('status')).not.toBeInTheDocument()
  })

  it('announces the copy outcome in the live region', async () => {
    stubClipboard(async () => undefined)
    render(<Identifier value={PARTY} label="party id" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy party id' }))

    await waitFor(() => expect(part('status')).toHaveTextContent('Copied party id'))
  })

  it('announces a failed copy in the live region', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    render(<Identifier value={PARTY} label="party id" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy party id' }))

    await waitFor(() => expect(part('status')).toHaveTextContent('Could not copy party id'))
  })

  it('copies the untruncated value and reports success', async () => {
    const written: string[] = []
    stubClipboard(async (v) => void written.push(v))
    const onCopy = vi.fn()
    render(<Identifier value={PARTY} label="party id" onCopy={onCopy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy party id' }))

    await waitFor(() => expect(written).toEqual([PARTY]))
    expect(onCopy).toHaveBeenCalledWith({ ok: true, value: PARTY })
  })

  it('moves the copy control to the copied state after a successful write', async () => {
    stubClipboard(async () => undefined)
    render(<Identifier value={PARTY} label="party id" />)
    expect(part('copy')).toHaveAttribute(anatomy.states.copy, 'idle')

    fireEvent.click(screen.getByRole('button', { name: 'Copy party id' }))

    await waitFor(() => expect(part('copy')).toHaveAttribute(anatomy.states.copy, 'copied'))
  })

  it('reports a failed write and moves to the error state', async () => {
    const failure = new Error('denied')
    stubClipboard(() => Promise.reject(failure))
    const onCopy = vi.fn()
    render(<Identifier value={PARTY} label="party id" onCopy={onCopy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy party id' }))

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith({ ok: false, error: failure }))
    expect(part('copy')).toHaveAttribute(anatomy.states.copy, 'error')
  })

  it('renders no link part without an href', () => {
    render(<Identifier value={PARTY} />)
    expect(part('link')).not.toBeInTheDocument()
  })

  // Delegation, not the link's own contract: target and rel are pinned in ExplorerLink.test.tsx.
  it('hands the href to an external link carrying the link part', () => {
    render(<Identifier value={PARTY} label="party id" href="https://scan.example/party/nico" />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass(anatomy.parts.link)
    expect(link).toHaveAttribute('href', 'https://scan.example/party/nico')
  })

  // Composing the name off `label` is this component's own job, not the link's.
  it('names the link after the label', () => {
    render(<Identifier value={PARTY} label="party id" href="https://scan.example/party/nico" />)
    expect(screen.getByRole('link', { name: 'View party id in explorer' })).toBeInTheDocument()
  })
})
