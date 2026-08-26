import { type IconProps, Svg } from '@/icons/Svg'

export const EyeIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
