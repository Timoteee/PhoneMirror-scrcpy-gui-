import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function move(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    refs.current[index]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      className="flex flex-wrap gap-1 rounded-sm bg-muted p-1"
      onKeyDown={(event) => {
        if (disabled) return
        const index = options.findIndex((option) => option.value === value)
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          move((index + 1) % options.length)
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          move((index - 1 + options.length) % options.length)
        } else if (event.key === 'Home') {
          event.preventDefault()
          move(0)
        } else if (event.key === 'End') {
          event.preventDefault()
          move(options.length - 1)
        }
      }}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className={cn(
              'h-8 rounded-sm px-3 text-sm',
              selected ? 'bg-card font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)]' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
