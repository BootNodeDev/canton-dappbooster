import { LoaderCircle } from 'lucide-react'

// The one spinning icon. lucide ships no animation, so a second call site spelling out
// `animate-spin` is how one of them ends up a frozen circle with nothing to catch it.
export const Spinner = ({ size }: { size?: number }): React.JSX.Element => (
  <LoaderCircle className="animate-spin" size={size} />
)
