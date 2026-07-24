import { Copyable } from '@/components/ui/Copyable'

// Success banner showing the ledger update id a command produced, with copy.
export const UpdateIdResult = ({ updateId }: { updateId: string }): JSX.Element => (
  <div className="flex items-center justify-between gap-2 rounded-md border border-success/40 bg-success-soft px-3 py-2">
    <div className="min-w-0">
      <div className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
        Update ID
      </div>
      <div className="break-all font-mono text-[0.82rem] text-foreground">{updateId}</div>
    </div>
    <Copyable
      value={updateId}
      label="update ID"
    />
  </div>
)
