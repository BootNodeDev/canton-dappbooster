import Avatar from 'boring-avatars'
import { cn } from '@/utils/cn'

interface AccountAvatarProps {
  partyId: string
  size?: 'sm' | 'md'
}

const SIZE_PX: Record<NonNullable<AccountAvatarProps['size']>, number> = {
  sm: 24,
  md: 40,
}

const SIZE_CLASS: Record<NonNullable<AccountAvatarProps['size']>, string> = {
  sm: 'size-6',
  md: 'size-10',
}

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

// 256 distinct colors: golden-angle hue spread keeps neighbouring indices far apart,
// with small saturation/lightness steps so wrapped hues stay separable. boring-avatars
// picks colors[hash % 256] for the face, so there are 256 colour schemes; the shape, eyes,
// and rotation still derive from the full party-id hash, so whole-avatar collisions stay rare.
const AVATAR_COLORS = Array.from({ length: 256 }, (_value, i) =>
  hslToHex((i * 137.508) % 360, 0.62 + (i % 3) * 0.08, 0.52 + (i % 2) * 0.08),
)

export const AccountAvatar = ({ partyId, size = 'md' }: AccountAvatarProps): JSX.Element => (
  <span
    aria-hidden="true"
    className={cn('shrink-0 overflow-hidden rounded-full ring-1 ring-black/10', SIZE_CLASS[size])}
  >
    <Avatar
      name={partyId}
      size={SIZE_PX[size]}
      variant="beam"
      colors={AVATAR_COLORS}
    />
  </span>
)
