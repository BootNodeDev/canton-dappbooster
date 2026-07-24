import { useExecute, useLedger, useParty } from 'canton-connect-kit'
import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ICON_BUTTON_CLASS, SecondaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { COPY_ICON, EYE_ICON } from '@/components/ui/icons'
import { Sheet } from '@/components/ui/Sheet'
import { TextInput } from '@/components/ui/TextInput'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { cn } from '@/utils/cn'
import { copyToClipboard } from '../../utils/clipboard'
import { errorMessage } from '../../utils/errorMessage'
import { formatPartyId, shortenIdentifier } from '../../utils/formatPartyId'
import {
  addStampCommand,
  applyOptimisticSlot,
  CARD_SIZE,
  canStamp,
  createTallyCommand,
  dropOverlay,
  findSuccessor,
  grantViewerCommand,
  grantWriterCommand,
  isPartyIdShape,
  migrateOverlay,
  normalizeTallyContract,
  type Reconciled,
  reconcileOrder,
  rollbackSlot,
  type SlotOverlay,
  stampStats,
  TALLY_TEMPLATE_ID,
  type TallyContract,
} from './loyaltySignature'

const commandId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

type ManageRole = 'staff' | 'cardholder'
type PartyDrafts = Record<string, Partial<Record<ManageRole, string>>>

// Stable per-slot keys (avoids index-as-key).
const SLOT_KEYS = Array.from({ length: CARD_SIZE }, (_, i) => `slot-${i}`)

// `filledSlots` are stamped; the rest are clickable "+".
const PunchCard = ({
  filledSlots,
  canAdd,
  busy,
  onAdd,
}: {
  filledSlots: number[]
  canAdd: boolean
  busy: boolean
  onAdd: (slot: number) => void
}): JSX.Element => (
  <div className="mt-2 grid grid-cols-5 gap-2">
    {SLOT_KEYS.map((key, i) => {
      if (filledSlots.includes(i)) {
        return (
          <div
            key={key}
            className="grid aspect-square place-items-center rounded-full bg-white text-3xl font-extrabold leading-none text-primary"
          >
            ★
          </div>
        )
      }
      if (!canAdd) {
        return (
          <div
            key={key}
            className="aspect-square rounded-full border-2 border-dashed border-white/70"
          />
        )
      }
      return (
        <button
          key={key}
          type="button"
          aria-label={`Add stamp to slot ${i + 1} of ${CARD_SIZE}`}
          data-testid="add-stamp"
          onClick={() => onAdd(i)}
          disabled={busy}
          className="grid aspect-square place-items-center rounded-full border-2 border-dashed border-white/70 text-3xl leading-none text-white/80 transition-colors enabled:hover:border-white enabled:hover:bg-white/20 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          +
        </button>
      )
    })}
  </div>
)

type ManageSectionProps = {
  addTestId: string
  buttonLabel: string
  disabled: boolean
  draft: string
  inputTestId: string
  onAdd: () => void
  onDraftChange: (value: string) => void
  title: string
}

const ManageSection = ({
  addTestId,
  buttonLabel,
  disabled,
  draft,
  inputTestId,
  onAdd,
  onDraftChange,
  title,
}: ManageSectionProps): JSX.Element => {
  const trimmed = draft.trim()
  const invalid = trimmed !== '' && !isPartyIdShape(trimmed)
  return (
    <section>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled && trimmed !== '' && !invalid) {
            onAdd()
          }
        }}
      >
        <TextInput
          data-testid={inputTestId}
          className="w-full font-mono text-sm"
          value={draft}
          error={invalid}
          aria-label={`${title} party id`}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="party::fingerprint"
          disabled={disabled}
        />
        {invalid && (
          <p className="text-xs text-danger">Enter a full party id (party::fingerprint).</p>
        )}
        <SecondaryButton
          type="submit"
          data-testid={addTestId}
          className="w-full"
          disabled={disabled || trimmed === '' || invalid}
        >
          {buttonLabel}
        </SecondaryButton>
      </form>
    </section>
  )
}

// Loyalty stamp card feature. Removable: delete this folder, its import + the
// <LoyaltyCard /> line in App.tsx, ../e2e/tests/features/loyalty, and the
// dapp/daml Tally module (see README "Removing a feature").
export const LoyaltyCard = (): JSX.Element | null => {
  const { party } = useParty()
  const { execute, lastTx, isExecuting } = useExecute()
  const { ledgerApi } = useLedger()

  const [tallies, setTallies] = useState<TallyContract[]>([])
  const [partyDrafts, setPartyDrafts] = useState<PartyDrafts>({})
  // Which card + role the "view parties" modal and the "add party" modal target.
  const [view, setView] = useState<{ contractId: string; role: ManageRole } | undefined>(undefined)
  const [addTo, setAddTo] = useState<{ contractId: string; role: ManageRole } | undefined>(
    undefined,
  )
  // Transient per-card stamped-slot overlay; reseeds sequentially on reload.
  const [filledSlots, setFilledSlots] = useState<SlotOverlay>({})
  // Stable React keys carried across contractId rotation (avoids remount flicker).
  const cardKeys = useRef<Map<string, string>>(new Map())
  const cardKeySeq = useRef(0)
  // Latest committed cards, read by loadTalliesFor so reconciliation never diffs
  // against a stale render closure when reloads overlap.
  const talliesRef = useRef<TallyContract[]>([])
  // Monotonic reload id: a superseded in-flight reload must not clobber state.
  const loadSeq = useRef(0)
  // Serialize stamping: blocks a same-frame second click before `busy` re-renders.
  const stamping = useRef(false)

  const busy = isExecuting

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the ACS only when the active party identity changes
  useEffect(() => {
    if (party === undefined) {
      talliesRef.current = []
      setTallies([])
      return
    }
    void loadTalliesFor(party.partyId)
  }, [party?.partyId])

  const loadTalliesFor = async (partyId: string): Promise<Reconciled[]> => {
    loadSeq.current += 1
    const seq = loadSeq.current
    try {
      const ledgerEnd = (await ledgerApi({
        requestMethod: 'get',
        resource: '/v2/state/ledger-end',
      })) as { offset?: number }
      if (typeof ledgerEnd.offset !== 'number') {
        throw new Error('ledger-end did not return an offset')
      }
      const response = (await ledgerApi({
        requestMethod: 'post',
        resource: '/v2/state/active-contracts',
        body: {
          filter: {
            filtersByParty: {
              [partyId]: {
                cumulative: [
                  {
                    identifierFilter: {
                      TemplateFilter: {
                        value: { templateId: TALLY_TEMPLATE_ID, includeCreatedEventBlob: true },
                      },
                    },
                  },
                ],
              },
            },
          },
          activeAtOffset: ledgerEnd.offset,
          verbose: true,
        },
      })) as unknown[]
      const parsed = (Array.isArray(response) ? response : []).flatMap((row) => {
        const tally = normalizeTallyContract(row)
        return tally === undefined ? [] : [tally]
      })
      // Diff against the latest committed cards, not this call's render closure.
      const reconciled = reconcileOrder(talliesRef.current, parsed)
      // Superseded by a newer reload: return the reconcile for the caller, but
      // let the newer load own committed state.
      if (seq !== loadSeq.current) {
        return reconciled
      }
      // Carry stable keys across recreation; mint fresh keys for new cards.
      const nextKeys = new Map<string, string>()
      for (const { tally, from } of reconciled) {
        const inherited = from !== undefined ? cardKeys.current.get(from) : undefined
        cardKeySeq.current += 1
        nextKeys.set(tally.contractId, inherited ?? `card-${cardKeySeq.current}`)
      }
      cardKeys.current = nextKeys
      talliesRef.current = reconciled.map((r) => r.tally)
      setTallies(talliesRef.current)
      return reconciled
    } catch (err) {
      toast.error(errorMessage(err))
      return []
    }
  }

  const runCommand = async (
    prefix: string,
    command: unknown,
    successMessage: string,
    actAsParties?: string[],
  ): Promise<Reconciled[] | undefined> => {
    if (party === undefined) {
      return undefined
    }
    const actAs = actAsParties ?? [party.partyId]
    try {
      await execute({
        commandId: commandId(prefix),
        commands: [command],
        actAs,
        readAs: [party.partyId],
      })
      const next = await loadTalliesFor(party.partyId)
      toast.success(successMessage)
      return next
    } catch (err) {
      toast.error(errorMessage(err))
      return undefined
    }
  }

  // Stamping recreates the Tally; runCommand reloads to get the live contractId
  // for the next stamp, then migrate the overlay onto the successor so clicked
  // slots stick (or roll the optimistic fill back if the tx failed).
  const addStamp = async (tally: TallyContract, slot: number): Promise<void> => {
    if (party === undefined) {
      stamping.current = false
      return
    }
    try {
      const stampActAs =
        tally.issuer === party.partyId ? [party.partyId] : [party.partyId, tally.issuer]
      const reconciled = await runCommand(
        'add-stamp',
        addStampCommand(tally, party.partyId),
        'Stamp added',
        stampActAs,
      )
      if (reconciled === undefined) {
        // runCommand already surfaced the error and re-read the ACS; just undo the
        // optimistic fill so the card reconverges to ledger truth.
        setFilledSlots((prev) => rollbackSlot(prev, tally.contractId, slot))
        return
      }
      // Stamping archived this Tally and recreated it; migrate the overlay onto
      // the successor `reconcileOrder` attributed to this contract id.
      const successor = findSuccessor(reconciled, tally.contractId)
      setFilledSlots((prev) =>
        successor !== undefined
          ? migrateOverlay(prev, tally.contractId, successor)
          : // No successor resolved (e.g. an ACS read race): drop the stale
            // overlay so its entry can't linger under the archived contract id.
            dropOverlay(prev, tally.contractId),
      )
    } finally {
      stamping.current = false
    }
  }

  // Grant, then close the modal and clear drafts on success; stay open on failure.
  const runManageCommand = async (
    prefix: string,
    command: unknown,
    successMessage: string,
    card: TallyContract,
  ): Promise<void> => {
    const next = await runCommand(prefix, command, successMessage)
    if (next === undefined) {
      return
    }
    setAddTo(undefined)
    setPartyDrafts((prev) => {
      const rest = { ...prev }
      delete rest[card.contractId]
      return rest
    })
  }

  const draftFor = (contractId: string, role: ManageRole): string =>
    partyDrafts[contractId]?.[role] ?? ''
  const updateDraft = (contractId: string, role: ManageRole, value: string): void => {
    setPartyDrafts((prev) => ({
      ...prev,
      [contractId]: { ...prev[contractId], [role]: value },
    }))
  }

  if (party === undefined) {
    return null
  }

  const adding =
    addTo !== undefined ? tallies.find((t) => t.contractId === addTo.contractId) : undefined
  const viewed =
    view !== undefined ? tallies.find((t) => t.contractId === view.contractId) : undefined
  const viewedParties =
    viewed === undefined
      ? []
      : view?.role === 'staff'
        ? viewed.writers.map(([w]) => w)
        : viewed.viewers

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Your stamp cards</h2>
          <p className="mt-1 flex max-w-prose flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
            You're the
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              merchant
              <Tooltip
                label="What is a merchant?"
                content="The party that issues a card. You create stamp cards, add stamps, and grant access to staff and cardholders."
              />
            </span>
            : issue stamp cards, let
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              staff
              <Tooltip
                label="What is staff?"
                content="A party you delegate stamping to. Staff can add stamps but can't manage who has access."
              />
            </span>
            add stamps, and add
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              cardholders
              <Tooltip
                label="What is a cardholder?"
                content="A party who can view a card and follow its stamps toward a reward, but can't add stamps."
              />
            </span>
            who collect stamps toward a reward.
          </p>
        </div>
        <button
          type="button"
          data-testid="new-card"
          aria-label="New card"
          title="New card"
          onClick={() => {
            void runCommand('create-tally', createTallyCommand(party.partyId), 'Card created')
          }}
          disabled={busy}
          className="inline-grid size-10 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-2xl leading-none text-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          +
        </button>
      </div>

      {tallies.length === 0 ? (
        <Card className="text-muted-foreground">
          <p className="m-0">No stamp cards yet. Create one to start collecting stamps.</p>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tallies.map((tally) => {
            const { filled, rewards } = stampStats(tally.value)
            const sequentialSlots = Array.from({ length: filled }, (_, i) => i)
            const slots = filledSlots[tally.contractId] ?? sequentialSlots
            return (
              <Card
                key={cardKeys.current.get(tally.contractId) ?? tally.contractId}
                className="flex flex-col gap-3"
                data-testid="tally-card"
                data-value={tally.value}
                data-contract-id={tally.contractId}
                data-issuer={tally.issuer}
                data-writers={tally.writers.length}
                data-viewers={tally.viewers.length}
              >
                <div className="rounded-xl bg-[image:var(--bg-gradient-brand)] p-3 text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold">Stamps</span>
                    <span className="text-xs">
                      {slots.length} / {CARD_SIZE}
                    </span>
                  </div>
                  <PunchCard
                    filledSlots={slots}
                    canAdd={canStamp(tally, party.partyId)}
                    busy={busy}
                    onAdd={(slot) => {
                      if (busy || stamping.current) {
                        return
                      }
                      stamping.current = true
                      setFilledSlots((prev) =>
                        applyOptimisticSlot(prev, tally.contractId, sequentialSlots, slot),
                      )
                      void addStamp(tally, slot)
                    }}
                  />
                  {rewards > 0 && (
                    <p className="m-0 mt-2 text-xs font-semibold">
                      {rewards} reward{rewards === 1 ? '' : 's'} earned
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    Card {shortenIdentifier(tally.contractId)}
                  </span>
                  <button
                    type="button"
                    aria-label="Copy card id"
                    title="Copy card id"
                    onClick={() => {
                      void copyToClipboard(tally.contractId, 'Card id copied.')
                    }}
                    className={cn(
                      ICON_BUTTON_CLASS,
                      'shrink-0 [&_svg]:size-3.5 enabled:hover:bg-transparent',
                    )}
                  >
                    {COPY_ICON}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{tally.writers.length} staff</span>
                    <button
                      type="button"
                      aria-label="View staff"
                      title="View staff"
                      onClick={() => setView({ contractId: tally.contractId, role: 'staff' })}
                      className={cn(
                        ICON_BUTTON_CLASS,
                        'shrink-0 [&_svg]:size-3.5 enabled:hover:bg-transparent',
                      )}
                    >
                      {EYE_ICON}
                    </button>
                    {tally.issuer === party.partyId && (
                      <button
                        type="button"
                        data-testid="open-add-staff"
                        aria-label="Add staff"
                        title="Add staff"
                        onClick={() => setAddTo({ contractId: tally.contractId, role: 'staff' })}
                        className="inline-grid size-6 place-items-center rounded-full border border-border-strong bg-surface text-sm leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        +
                      </button>
                    )}
                  </div>
                  <span className="h-4 w-px bg-border" aria-hidden="true" />
                  <div className="flex items-center gap-2">
                    <span>{tally.viewers.length} cardholders</span>
                    <button
                      type="button"
                      aria-label="View cardholders"
                      title="View cardholders"
                      onClick={() => setView({ contractId: tally.contractId, role: 'cardholder' })}
                      className={cn(
                        ICON_BUTTON_CLASS,
                        'shrink-0 [&_svg]:size-3.5 enabled:hover:bg-transparent',
                      )}
                    >
                      {EYE_ICON}
                    </button>
                    {tally.issuer === party.partyId && (
                      <button
                        type="button"
                        data-testid="open-add-cardholder"
                        aria-label="Add cardholder"
                        title="Add cardholder"
                        onClick={() =>
                          setAddTo({ contractId: tally.contractId, role: 'cardholder' })
                        }
                        className="inline-grid size-6 place-items-center rounded-full border border-border-strong bg-surface text-sm leading-none text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </section>
      )}

      <Sheet
        open={addTo !== undefined && adding !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setAddTo(undefined)
          }
        }}
        side="center"
        title={addTo?.role === 'staff' ? 'Add staff' : 'Add cardholder'}
        description="Grant another party access to this card by their party id."
      >
        {addTo !== undefined && adding !== undefined && (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              Create accounts in your wallet, then copy a party id from there to paste here.
            </p>
            <ManageSection
              addTestId={addTo.role === 'staff' ? 'add-staff' : 'add-cardholder'}
              buttonLabel={addTo.role === 'staff' ? 'Add staff' : 'Add cardholder'}
              disabled={adding.issuer !== party.partyId || busy}
              draft={draftFor(adding.contractId, addTo.role)}
              inputTestId={
                addTo.role === 'staff' ? 'staff-party-id-input' : 'cardholder-party-id-input'
              }
              onAdd={() => {
                const value = draftFor(adding.contractId, addTo.role).trim()
                void runManageCommand(
                  addTo.role === 'staff' ? 'grant-writer' : 'grant-viewer',
                  addTo.role === 'staff'
                    ? grantWriterCommand(adding, value)
                    : grantViewerCommand(adding, value),
                  addTo.role === 'staff' ? 'Staff added' : 'Cardholder added',
                  adding,
                )
              }}
              onDraftChange={(value) => updateDraft(adding.contractId, addTo.role, value)}
              title={addTo.role === 'staff' ? 'Staff' : 'Cardholders'}
            />
          </>
        )}
      </Sheet>

      <Sheet
        open={view !== undefined && viewed !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setView(undefined)
          }
        }}
        side="center"
        title={view?.role === 'staff' ? 'Staff' : 'Cardholders'}
        description="Party ids with access to this card."
      >
        {viewedParties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {view?.role === 'staff' ? 'No staff yet.' : 'No cardholders yet.'}
          </p>
        ) : (
          <ul className="flex h-72 flex-col gap-1 overflow-y-auto">
            {viewedParties.map((partyId) => (
              <li key={partyId} className="flex items-center gap-2 rounded-lg bg-muted p-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {formatPartyId(partyId)}
                </span>
                <button
                  type="button"
                  aria-label="Copy party id"
                  title="Copy party id"
                  onClick={() => {
                    void copyToClipboard(partyId, 'Party id copied.')
                  }}
                  className="inline-grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-primary [&_svg]:size-3.5"
                >
                  {COPY_ICON}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      {lastTx !== undefined && (
        <section
          className="ui-hidden"
          data-testid="tx-status"
          data-tx-status={lastTx.status}
          data-tx-command-id={lastTx.commandId ?? ''}
        >
          <span>Last activity: {lastTx.status}</span>
          {lastTx.commandId !== undefined && lastTx.commandId.length > 0 && (
            <code>{shortenIdentifier(lastTx.commandId)}</code>
          )}
        </section>
      )}
    </>
  )
}
