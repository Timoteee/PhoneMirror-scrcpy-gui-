import type { LogLine } from '@shared/types'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function LogPane({
  lines,
  open,
  onToggle,
}: {
  lines: LogLine[]
  open: boolean
  onToggle: () => void
}) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const last = lines[lines.length - 1]
  const hasError = lines.some((line) => line.level === 'error')

  useEffect(() => {
    if (!open) return
    const node = scroller.current
    if (!node) return
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48
    if (nearBottom) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lines, open])

  return (
    <section className="border-t border-border bg-card" aria-labelledby="log-heading">
      <h2 id="log-heading">
        <button type="button" className="flex w-full items-center gap-3 px-6 py-3 text-left" aria-expanded={open} aria-controls="session-log" onClick={onToggle}>
          <span className="font-semibold">Session log</span>
          {hasError && <span className="text-sm text-destructive">Needs attention</span>}
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{last ? last.text : 'Nothing yet'}</span>
          <ChevronDown className={cn('size-4 shrink-0', open && 'rotate-180')} aria-hidden />
        </button>
      </h2>
      {open && (
        <div id="session-log" ref={scroller} className="mx-6 mb-4 max-h-44 overflow-auto rounded-sm bg-muted px-3 py-2" tabIndex={0} aria-label="scrcpy output">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">scrcpy output will show up here.</p>
          ) : (
            <ol className="grid gap-1">
              {lines.map((line) => (
                <li key={line.id} className={line.level === 'error' ? 'font-mono text-[13px] leading-5 text-destructive' : 'font-mono text-[13px] leading-5'}>
                  <span className="text-muted-foreground">{formatTime(line.ts)} </span>
                  <span className="text-muted-foreground">{line.source}: </span>
                  {line.text}
                </li>
              ))}
            </ol>
          )}
          <div ref={endRef} />
        </div>
      )}
    </section>
  )
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
