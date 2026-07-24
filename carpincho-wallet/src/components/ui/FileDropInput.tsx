interface FileDropInputProps {
  id: string
  accept: string
  ariaLabel: string
  prompt: string
  fileName: string | null
  onSelect: (file: File | null) => void
  testId?: string
}

// Visually-hidden file input fronted by a dashed dropzone label; shows the chosen
// file name once picked. Shared by the DAR upload and vault import surfaces.
export const FileDropInput = ({
  id,
  accept,
  ariaLabel,
  prompt,
  fileName,
  onSelect,
  testId,
}: FileDropInputProps): JSX.Element => (
  <>
    <input
      id={id}
      data-testid={testId}
      type="file"
      accept={accept}
      aria-label={ariaLabel}
      className="sr-only"
      onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)}
    />
    <label
      htmlFor={id}
      className="cursor-pointer rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center hover:border-primary/60"
    >
      {fileName === null ? (
        <span className="text-[0.82rem] font-medium text-muted-foreground">{prompt}</span>
      ) : (
        <span className="rounded-sm bg-muted px-2 py-1 font-mono text-[0.82rem] text-foreground">
          {fileName}
        </span>
      )}
    </label>
  </>
)
