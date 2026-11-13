import Avatar from 'boring-avatars'

const DEFAULT_SIZE_PX = 24

const hslToHex = (h: number, s: number, l: number): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const base = l - c / 2
  const sextants = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = sextants[Math.floor(h / 60) % 6]
  const channel = (value: number): string =>
    Math.round((value + base) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

// boring-avatars picks one colour per hash: its 5 defaults collide, 256 golden-angle hues do not.
const AVATAR_COLORS = Array.from({ length: 256 }, (_value, i) =>
  hslToHex((i * 137.508) % 360, 0.62 + (i % 3) * 0.08, 0.52 + (i % 2) * 0.08),
)

export const PartyAvatar = ({
  partyId,
  size = DEFAULT_SIZE_PX,
}: {
  partyId: string
  size?: number
}): React.JSX.Element => (
  <span
    aria-hidden="true"
    // Grid, not inline: an inline SVG leaves descender space under the baseline.
    className="grid shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
    style={{ height: size, width: size }}
  >
    <Avatar colors={AVATAR_COLORS} name={partyId} size={size} variant="beam" />
  </span>
)
