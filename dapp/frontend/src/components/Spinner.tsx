import { LoaderCircle } from 'lucide-react'

export const Spinner = ({ size }: { size?: number }): React.JSX.Element => (
  <LoaderCircle className="animate-spin" size={size} />
)
