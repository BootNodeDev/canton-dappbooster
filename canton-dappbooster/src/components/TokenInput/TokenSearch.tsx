import type { ReactElement, RefObject } from 'react'
import { dialogAnatomy as anatomy } from '#src/components/TokenInput/anatomy'
import { SearchIcon } from '#src/icons'

interface TokenSearchProps {
  onChange: (query: string) => void
  ref?: RefObject<HTMLInputElement | null>
  value: string
}

/**
 * The token select's filter field
 *
 * @example
 * <TokenSearch onChange={setQuery} ref={searchRef} value={query} />
 */
export const TokenSearch = ({ onChange, ref, value }: TokenSearchProps): ReactElement => (
  <div className={anatomy.parts.searchField}>
    <span className={anatomy.parts.searchIcon}>
      <SearchIcon />
    </span>
    <input
      aria-label="Search tokens"
      autoComplete="off"
      className={anatomy.parts.search}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by name or symbol"
      ref={ref}
      spellCheck={false}
      type="search"
      value={value}
    />
  </div>
)
