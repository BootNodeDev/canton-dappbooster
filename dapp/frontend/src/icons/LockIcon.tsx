import { type IconProps, Svg } from '@/icons/Svg'

export const LockIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <rect x="4.5" y="11" width="15" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
)
