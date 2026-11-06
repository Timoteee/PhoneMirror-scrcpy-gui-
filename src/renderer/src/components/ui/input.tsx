import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
