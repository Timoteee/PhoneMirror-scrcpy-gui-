import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm text-sm font-semibold leading-5 disabled:pointer-events-none disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground',
  {
    variants: {
      variant: {
        primary: 'border border-transparent bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]',
        secondary: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'border border-transparent bg-transparent text-foreground hover:bg-muted',
        destructive: 'border border-destructive bg-card text-destructive hover:bg-[var(--danger-bg)]',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3',
        block: 'h-10 w-full px-4',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...(asChild ? {} : { type })} {...props} />
}
