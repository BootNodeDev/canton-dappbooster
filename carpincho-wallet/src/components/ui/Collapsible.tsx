import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export const Collapsible = CollapsiblePrimitive.Root

export const CollapsibleTrigger = ({
  className,
  testId,
  children,
}: {
  className?: string
  testId?: string
  children: ReactNode
}): JSX.Element => (
  <CollapsiblePrimitive.Trigger
    data-testid={testId}
    className={cn(
      'flex w-full items-center gap-2 outline-none focus-visible:shadow-focus',
      className,
    )}
  >
    {children}
  </CollapsiblePrimitive.Trigger>
)

export const CollapsibleContent = ({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}): JSX.Element => (
  <CollapsiblePrimitive.Content className={cn('overflow-hidden', className)}>
    {children}
  </CollapsiblePrimitive.Content>
)
