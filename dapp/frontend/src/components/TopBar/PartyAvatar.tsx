import Avatar from 'boring-avatars'

const SIZE_PX = 24

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

// boring-avatars picks one colour per hash, so its five defaults collide on sight; a golden-angle
// hue spread gives 256 that stay separable, while shape and rotation still use the whole id.
const AVATAR_COLORS = Array.from({ length: 256 }, (_value, i) =>
  hslToHex((i * 137.508) % 360, 0.62 + (i % 3) * 0.08, 0.52 + (i % 2) * 0.08),
)

export const PartyAvatar = ({ partyId }: { partyId: string }): React.JSX.Element => (
  <span
    aria-hidden="true"
    className="size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
  >
    <Avatar colors={AVATAR_COLORS} name={partyId} size={SIZE_PX} variant="beam" />
  </span>
)
