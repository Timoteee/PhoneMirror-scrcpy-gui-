import type { FolderListing, TransferRequest, TransferUpdate } from '@shared/transfer'
import { formatBytes, isSafeDevicePath, parentDevicePath } from '@shared/transfer'
import type { ActionResult, Device } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Segmented } from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Tab = 'send' | 'get'

const DEFAULT_FOLDER = '/sdcard/Download'
/** A folder can hold thousands of entries; render enough to be useful, not enough to stall the window. */
const MAX_ROWS = 500

export function FilesDialog({
  open,
  onOpenChange,
  device,
  onDone,
  initialTab,
  preview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: Device | null
  onDone: (result: ActionResult) => void
  /** Screenshot harness only: open on a tab and show a captured listing instead of adb. */
  initialTab?: Tab
  preview?: { listing: FolderListing; selected: string[]; destination: string }
}) {
  const [tab, setTab] = useState<Tab>('send')
  const [sendPaths, setSendPaths] = useState<string[]>([])
  const [target, setTarget] = useState(DEFAULT_FOLDER)
  const [folder, setFolder] = useState(DEFAULT_FOLDER)
  const [draft, setDraft] = useState(DEFAULT_FOLDER)
  const [listing, setListing] = useState<FolderListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [destination, setDestination] = useState<string | null>(null)
  const [active, setActive] = useState<TransferUpdate | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [starting, setStarting] = useState(false)
  const [dropping, setDropping] = useState(false)
  const finishRef = useRef(onDone)
  useEffect(() => {
    finishRef.current = onDone
  }, [onDone])

  const serial = device?.serial ?? null
  const running = active?.state === 'running'
  const ready = device?.state === 'device'

  useEffect(() => {
    if (!window.phoneMirror) return
    return window.phoneMirror.onTransfer((update) => {
      if (update.serial !== serial) return
      setActive(update)
      if (update.state === 'running') return
      setActive(null)
      const outcome: ActionResult =
        update.state === 'cancelled'
          ? { ok: false, error: update.message ?? 'Cancelled.' }
          : update.state === 'failed'
            ? { ok: false, error: update.message ?? 'The transfer stopped.' }
            : { ok: true, message: update.message ?? 'Finished.' }
      setResult(outcome)
      finishRef.current(outcome)
    })
  }, [serial])

  const load = useCallback(
    async (path: string) => {
      if (!window.phoneMirror || !serial) return
      setLoading(true)
      setSelected([])
      const next = await window.phoneMirror.listDeviceFolder({ serial, path })
      setLoading(false)
      setListing(next)
      setFolder(path)
      setDraft(path)
    },
    [serial],
  )

  useEffect(() => {
    if (!open) return
    if (initialTab) setTab(initialTab)
    setResult(null)
  }, [open, initialTab])

  useEffect(() => {
    if (!open || tab !== 'get' || !ready) return
    if (preview) {
      setListing(preview.listing)
      setFolder(preview.listing.path)
      setDraft(preview.listing.path)
      setSelected(preview.selected)
      setDestination(preview.destination)
      return
    }
    void load(folder)
  }, [open, tab, ready, serial, preview])

  const targetProblem = isSafeDevicePath(target) ? null : 'Type a folder on the phone, such as /sdcard/Download.'
  const apkInBatch = sendPaths.some((item) => /\.apk$/i.test(item))
  const toggle = (path: string) => {
    setSelected((current) => (current.includes(path) ? current.filter((item) => item !== path) : [...current, path]))
  }

  async function addPaths(paths: string[]) {
    if (paths.length === 0) return
    setSendPaths((current) => [...new Set([...current, ...paths])].slice(0, 50))
  }

  async function send() {
    if (!window.phoneMirror || !serial || running) return
    setStarting(true)
    setResult(null)
    const request: TransferRequest = { serial, direction: 'send', target, paths: sendPaths }
    const started = await window.phoneMirror.startTransfer(request)
    setStarting(false)
    if (started.ok) setSendPaths([])
    else setResult({ ok: false, error: started.error })
  }

  async function get() {
    if (!window.phoneMirror || !serial || running || !destination) return
    setStarting(true)
    setResult(null)
    const request: TransferRequest = { serial, direction: 'get', target: destination, paths: selected }
    const started = await window.phoneMirror.startTransfer(request)
    setStarting(false)
    if (started.ok) setSelected([])
    else setResult({ ok: false, error: started.error })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100%-32px))]">
        <DialogTitle>Files{device ? ` — ${device.model}` : ''}</DialogTitle>
        <DialogDescription>
          Send files to this phone, or copy files off it. Transfers keep running if you close this window.
        </DialogDescription>

        <div className="mt-4">
          <Segmented<Tab>
            label="Transfer direction"
            value={tab}
            options={[
              { value: 'send', label: 'Send to phone' },
              { value: 'get', label: 'Get from phone' },
            ]}
            onChange={(next) => {
              setTab(next)
              setResult(null)
            }}
            disabled={Boolean(running)}
          />
        </div>

        {running && active ? (
          <TransferProgress
            update={active}
            onCancel={() => {
              if (active) void window.phoneMirror?.cancelTransfer(active.id)
            }}
          />
        ) : tab === 'send' ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!ready}
                onClick={() => {
                  void window.phoneMirror?.pickFiles().then((files) => addPaths(files))
                }}
              >
                Add files…
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!ready}
                onClick={() => {
                  void window.phoneMirror?.pickFolder().then((folderPath) => addPaths(folderPath ? [folderPath] : []))
                }}
              >
                Add folder…
              </Button>
            </div>

            <div
              className={`rounded-md border border-dashed p-3 text-sm ${dropping ? 'border-primary bg-muted' : 'border-border'}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDropping(true)
              }}
              onDragLeave={() => setDropping(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDropping(false)
                const files = Array.from(event.dataTransfer.files)
                const paths = window.phoneMirror?.getDroppedPaths(files) ?? []
                void addPaths(paths)
              }}
            >
              <p className="font-semibold">Drop files or folders here</p>
              <p className="mt-1 text-muted-foreground">
                {sendPaths.length === 0
                  ? 'Or use the buttons above. Folders are copied with everything inside them.'
                  : `${sendPaths.length} item${sendPaths.length === 1 ? '' : 's'} ready.`}
              </p>
              {sendPaths.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-auto">
                  {sendPaths.map((item) => (
                    <li key={item} className="flex items-center justify-between gap-3">
                      <span className="truncate" title={item}>
                        {pcName(item)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSendPaths((current) => current.filter((entry) => entry !== item))}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-semibold">Send to</span>
              <Input
                className="mt-1 font-mono"
                value={target}
                spellCheck={false}
                onChange={(event) => setTarget(event.target.value)}
                aria-invalid={targetProblem ? true : undefined}
                aria-describedby="send-target-note"
              />
              <span id="send-target-note" className="mt-1 block text-sm text-muted-foreground">
                {targetProblem ?? 'A folder on the phone. /sdcard/Download is the usual place.'}
              </span>
            </label>
            {apkInBatch && (
              <p className="text-sm text-muted-foreground">APK files are installed on the phone instead of copied.</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="text-sm font-semibold">Phone folder</span>
                <Input
                  className="mt-1 font-mono"
                  value={draft}
                  spellCheck={false}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void load(draft)
                  }}
                />
              </label>
              <Button size="sm" variant="secondary" onClick={() => void load(draft)}>
                Go
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void load(parentDevicePath(folder))}>
                Up
              </Button>
            </div>

            <div className="max-h-64 min-h-32 overflow-auto rounded-md border border-border">
              {loading ? (
                <p className="p-3 text-sm text-muted-foreground" role="status">
                  Reading that folder…
                </p>
              ) : listing?.error ? (
                <p className="p-3 text-sm text-destructive" role="alert">
                  {listing.error}
                </p>
              ) : !listing || listing.entries.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">This folder is empty.</p>
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {listing.entries.slice(0, MAX_ROWS).map((entry) => (
                      <li key={entry.path}>
                        {entry.dir ? (
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => void load(entry.path)}
                          >
                            <span className="truncate font-semibold">{entry.name}</span>
                            <span className="shrink-0 text-muted-foreground">Folder</span>
                          </button>
                        ) : (
                          <label
                            className={`flex items-center gap-3 px-3 py-2 text-sm ${entry.link ? 'opacity-60' : 'cursor-pointer hover:bg-muted'}`}
                          >
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={selected.includes(entry.path)}
                              disabled={Boolean(entry.link)}
                              onChange={() => toggle(entry.path)}
                            />
                            <span className="min-w-0 flex-1 truncate" title={entry.name}>
                              {entry.name}
                            </span>
                            <span className="shrink-0 text-muted-foreground">
                              {entry.link ? 'Link' : formatBytes(entry.size)}
                            </span>
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                  {listing.entries.length > MAX_ROWS ? (
                    <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                      {`Showing the first ${MAX_ROWS} of ${listing.entries.length} items. Open a subfolder, or type a path inside it.`}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {selected.length === 0 ? 'Choose one or more files.' : `${selected.length} selected`}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void window.phoneMirror?.pickDestination().then((folderPath) => {
                    if (folderPath) setDestination(folderPath)
                  })
                }}
              >
                Choose folder on this PC…
              </Button>
            </div>
            <p className="truncate text-sm text-muted-foreground" title={destination ?? undefined}>
              {destination ?? 'No folder on this PC chosen yet.'}
            </p>
          </div>
        )}

        {result && !result.ok && (
          <p role="alert" className="mt-4 rounded-md border border-destructive bg-[var(--danger-bg)] px-3 py-2 text-sm text-destructive">
            {result.error}
          </p>
        )}
        {result && result.ok && (
          <p role="status" className="mt-4 rounded-md border border-success bg-[var(--success-bg)] px-3 py-2 text-sm text-success">
            {result.message ?? 'Finished.'}
          </p>
        )}

        {!running && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {tab === 'send' ? (
              <Button
                variant="primary"
                disabled={!ready || sendPaths.length === 0 || Boolean(targetProblem) || starting}
                aria-busy={starting}
                onClick={() => void send()}
              >
                {starting ? 'Starting…' : 'Send to phone'}
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={!ready || selected.length === 0 || !destination || starting}
                aria-busy={starting}
                onClick={() => void get()}
              >
                {starting ? 'Starting…' : 'Get from phone'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function busyCaption(label: string): string {
  if (/\.apk$/i.test(label)) return 'Installing on the phone…'
  return 'Working… adb does not report bytes for folders.'
}

function TransferProgress({ update, onCancel }: { update: TransferUpdate; onCancel: () => void }) {
  const percent = update.percent
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-semibold" aria-live="polite">
        {`${update.index} of ${update.total} · ${update.label}`}
      </p>
      <div
        role="progressbar"
        aria-label="Transfer progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="h-2 w-full overflow-hidden rounded-sm bg-muted"
      >
        <div
          className={`h-full bg-primary transition-[width] ${percent === null ? 'w-1/3 animate-pulse' : ''}`}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {percent === null ? busyCaption(update.label) : `${percent}%`}
        </span>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function pcName(value: string): string {
  const trimmed = value.replace(/[\\/]+$/, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return index < 0 ? trimmed : trimmed.slice(index + 1)
}
