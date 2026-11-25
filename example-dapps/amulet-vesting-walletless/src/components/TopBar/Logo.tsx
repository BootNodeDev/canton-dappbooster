import { Link } from 'react-router-dom'
import { LogoMark } from '@/icons'

export const Logo = ({ search }: { search: string }): React.JSX.Element => (
  <Link to={`/${search}`} className="flex items-center gap-2.5">
    <LogoMark />
    <span className="text-[0.95rem] tracking-tight text-fg">
      <span className="font-medium">Canton</span> <span className="font-extrabold">Vesting</span>
    </span>
  </Link>
)
