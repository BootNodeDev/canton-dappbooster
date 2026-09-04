/**
 * Everything importable from `@bootnodedev/canton-dappbooster` itself. `<ConnectButton>` is not
 * here: it reads the wallet session, so it lives on the `/connect` sub-path.
 *
 * @module Main
 */

export { ExplorerLink, type ExplorerLinkProps } from '#src/components/ExplorerLink'
export { Identifier, type IdentifierProps } from '#src/components/Identifier'
export {
  partyHint,
  type TruncateOptions,
  truncateIdentifier,
} from '#src/components/Identifier/truncate'
export { PartyIdInput, type PartyIdInputProps } from '#src/components/PartyIdInput'
export { TokenInput, type TokenInputProps, type TokenMeta } from '#src/components/TokenInput'
export {
  type CopyOutcome,
  type CopyState,
  type UseCopyToClipboardOptions,
  type UseCopyToClipboardResult,
  useCopyToClipboard,
} from '#src/hooks/useCopyToClipboard'
export {
  type ExplorerConfig,
  type ExplorerEntity,
  type GetExplorerLinkParams,
  getExplorerLink,
  useExplorerLink,
} from '#src/hooks/useExplorerLink'
export { ThemeProvider, type ThemeProviderProps } from '#src/providers/ThemeProvider'
export type { ResolvedTheme, ThemeMode, UseThemeResult } from '#src/providers/ThemeProvider/context'
export { useTheme } from '#src/providers/ThemeProvider/useTheme'
export {
  TokenListProvider,
  type TokenListProviderProps,
} from '#src/providers/TokenListProvider'
export type {
  InstrumentId,
  Token,
  UseTokenListResult,
} from '#src/providers/TokenListProvider/context'
export { useTokenList } from '#src/providers/TokenListProvider/useTokenList'
export { mergeTokens, type PartialToken } from '#src/utils/mergeTokens'
export { isValidPartyId, type PartyIdError, validatePartyId } from '#src/utils/partyId'
export { type Instrument, readInstruments } from '#src/utils/readInstruments'
export { type Holding, type InstrumentBalance, sumHoldings } from '#src/utils/sumHoldings'
export {
  DEFAULT_PRECISION,
  formatAmount,
  formatScaled,
  parseAmount,
  sanitizeAmountInput,
  type TokenAmountError,
  validateAmount,
} from '#src/utils/tokenAmount'
export { tokenKey } from '#src/utils/tokenKey'
