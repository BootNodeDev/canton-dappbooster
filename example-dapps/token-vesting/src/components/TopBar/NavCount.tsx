export const NavCount = ({ count = 0 }: { count?: number }): React.JSX.Element | null =>
  count > 0 ? (
    <>
      <span
        aria-hidden="true"
        className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--badge)] px-1.5 text-[0.7rem] font-bold tabular-nums text-[var(--badge-fg)]"
      >
        {count}
      </span>
      <span className="sr-only">({count} awaiting you)</span>
    </>
  ) : null
