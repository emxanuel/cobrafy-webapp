/* eslint-disable react-refresh/only-export-components -- variants exported with Button */
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/features/shared/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border-2 border-transparent font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 text-base',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:border-accent-border',
        outline:
          'border-border bg-bg text-heading hover:border-accent-border hover:text-accent',
        ghost: 'bg-transparent text-heading hover:bg-muted',
        danger: 'bg-danger-bg text-danger hover:border-danger',
        link: 'min-h-0 px-0 text-accent underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

export { buttonVariants }
