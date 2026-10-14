import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/features/shared/lib/cn'

type FieldProps = {
  id: string
  label: string
  error?: string
  hint?: string
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={id} className="text-heading text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p className="text-text text-sm">{hint}</p>
      ) : null}
    </div>
  )
}

const controlClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2.5 text-heading outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 aria-invalid:border-danger'

export function TextInput({
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      className={cn(controlClass, className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  )
}

export function TextArea({
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <textarea
      className={cn(controlClass, 'min-h-24', className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  )
}

export function SelectInput({
  error,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      className={cn(controlClass, className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      {...props}
    >
      {children}
    </select>
  )
}
