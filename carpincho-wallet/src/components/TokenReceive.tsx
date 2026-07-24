import QRCode from 'react-qr-code'
import { DetailRow } from '@/components/ui/DetailRow'

interface TokenReceiveProps {
  partyId: string
}

// Receive screen: a scannable QR of the party id with the full id and copy below.
export const TokenReceive = ({ partyId }: TokenReceiveProps): JSX.Element => (
  <div className="flex flex-col items-center gap-5">
    {/* Fixed light QR keeps it scannable in dark mode too. */}
    <div
      data-testid="receive-qr"
      className="rounded-xl border border-border bg-white p-4"
    >
      <QRCode
        value={partyId}
        size={208}
        bgColor="#ffffff"
        fgColor="#14152b"
        level="M"
      />
    </div>
    <dl className="m-0 w-full">
      <DetailRow
        label="Your party ID"
        value={partyId}
        copyLabel="party ID"
        copyTestId="receive-copy-party-id"
      />
    </dl>
  </div>
)
