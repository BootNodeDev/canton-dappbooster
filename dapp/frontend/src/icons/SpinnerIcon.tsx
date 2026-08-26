import { type IconProps, Svg } from '@/icons/Svg'

// A three-quarter arc, so the rotation is visible at all.
export const SpinnerIcon = (p: IconProps): React.JSX.Element => (
  <Svg className="animate-spin" {...p}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Svg>
)
