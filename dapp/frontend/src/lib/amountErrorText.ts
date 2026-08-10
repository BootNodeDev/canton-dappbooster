import type { TokenAmountError } from '@bootnodedev/canton-dappbooster'

// Exhaustive by type, so a code added upstream fails the build here instead of rendering nothing.
export const AMOUNT_ERROR_TEXT: Record<TokenAmountError, string> = {
  'not-a-number': 'Enter a number.',
  'too-many-decimals': 'At most 10 decimal places.',
  'too-large': 'That amount is too large for the ledger.',
  'above-max': 'More than is available.',
}
