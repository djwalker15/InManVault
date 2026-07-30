import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  leading?: ReactNode
  trailing?: ReactNode
  /** Convenience callback that receives just the new string value. */
  onValueChange?: (v: string) => void
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    label,
    hint,
    error,
    leading,
    trailing,
    onValueChange,
    // Pulled out of `rest` on purpose: `{...rest}` is spread after these
    // handlers below, so leaving them in would let a caller's version replace
    // the wrapper's and silently kill the focus styling.
    onChange,
    onFocus,
    onBlur,
    id,
    className,
    ...rest
  },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const [focused, setFocused] = useState(false)

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <label
        htmlFor={inputId}
        className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900"
      >
        {label}
      </label>
      <div
        className={cn(
          'relative mt-2 flex h-14 items-center rounded-xl px-4 transition',
          'border-b-2',
          focused
            ? 'bg-paper-250 border-sage-700'
            : 'bg-paper-100 border-transparent',
          error && 'border-error',
        )}
      >
        {leading && (
          <span className="pointer-events-none mr-3 flex items-center text-ink-600">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? errorId : hint ? hintId : undefined
          }
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          onChange={(e) => {
            onValueChange?.(e.target.value)
            onChange?.(e)
          }}
          {...rest}
          className={cn(
            'h-full flex-1 bg-transparent font-body text-base text-ink-900',
            'outline-none placeholder:text-ink-500',
          )}
        />
        {trailing && (
          <span className="ml-3 flex items-center">{trailing}</span>
        )}
      </div>
      {error ? (
        <p
          id={errorId}
          className="mt-2 px-1 font-body text-sm text-error"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          className="mt-2 px-1 font-body text-sm text-ink-500"
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
})
