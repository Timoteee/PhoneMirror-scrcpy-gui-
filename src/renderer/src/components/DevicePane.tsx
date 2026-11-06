import { formatCommand, tryBuildScrcpyArgs, windowTitleFor } from '@shared/args'
import { validateSettings } from '@shared/settings'
import type { Device, MirrorSettings, SessionInfo } from '@shared/types'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { connectionLabel, programName, statusLabel } from '@/lib/labels'

export function DevicePane({
  devices,
  error,
  loading,
  selected,
  onSelect,
  sessions,
  pending,
  settings,
  scrcpyPath,
  refreshing,
  onRefresh,
  onWifi,
  onStart,
  onStop,
  onStartAll,
  onDisconnect,
  banner,
}: {
  devices: Device[]
  error: string | null
  loading: boolean
  selected: string | null
  onSelect: (serial: string) => void
  sessions: SessionInfo[]
  pending: boolean
  settings: MirrorSettings
  scrcpyPath: string | null
  refreshing: boolean
  onRefresh: () => void
  onWifi: () => void
  onStart: () => void
  onStop: (serial: string) => void
  onStartAll: () => void
  onDisconnect: (serial: string) => void
  banner: { tone: 'success' | 'danger'; text: string } | null
}) {
  const selectedDevice = devices.find((device) => device.serial === selected) ?? null
  const running = selectedDevice ? sessions.some((session) => session.serial === selectedDevice.serial && session.running) : false
  const readyCount = devices.filter((device) => device.state === 'device').length
  const settingsProblem = validateSettings(settings)
  const blockReason = running
    ? null
    : !scrcpyPath
      ? 'scrcpy is missing. Reinstall Phone Mirror, or choose it under Advanced.'
      : !selectedDevice
        ? 'Connect a phone to start.'
        : selectedDevice.state === 'unauthorized'
          ? 'Unlock the phone and tap Allow, then start mirroring.'
          : selectedDevice.state !== 'device'
            ? 'This phone is not ready. Unlock it and try again.'
            : settingsProblem

  const title = selectedDevice ? windowTitleFor(selectedDevice.model) : 'Phone Mirror'
  const built = tryBuildScrcpyArgs({
    settings,
    serial: selectedDevice?.serial,
    windowTitle: title,
  })
  const executable = programName(scrcpyPath)
  const command = built.ok ? formatCommand(executable, built.args) : null
  const copyCommand = built.ok ? formatCommand(scrcpyPath ?? executable, built.args) : null

  return (
    <section id="phones" className="flex min-h-0 flex-col gap-4 p-6 min-[860px]:w-[440px] min-[860px]:shrink-0" aria-labelledby="phones-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="phones-heading" className="text-base font-semibold">
          Phones
        </h2>
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {banner && (
        <p
          role={banner.tone === 'danger' ? 'alert' : 'status'}
          className={banner.tone === 'danger' ? 'rounded-md border border-destructive bg-[var(--danger-bg)] px-3 py-2 text-sm text-destructive' : 'rounded-md border border-success bg-[var(--success-bg)] px-3 py-2 text-sm text-success'}
        >
          {banner.text}
        </p>
      )}

      <div className="max-h-[480px] overflow-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Looking for phones…
          </p>
        ) : error && devices.length === 0 ? (
          <div role="alert" className="rounded-md border border-destructive bg-[var(--danger-bg)] p-4 text-sm text-destructive">
            <p className="font-semibold">Phone Mirror cannot see any phones</p>
            <p className="mt-2">{error}</p>
          </div>
        ) : devices.length === 0 ? (
          <EmptyState onWifi={onWifi} />
        ) : (
          <DeviceList
            devices={devices}
            selected={selected}
            sessions={sessions}
            onSelect={onSelect}
            onStop={onStop}
            onDisconnect={onDisconnect}
          />
        )}
      </div>

      {devices.length > 0 && (
        <Button variant="ghost" className="justify-start px-1" onClick={onWifi}>
          Connect over Wi-Fi
        </Button>
      )}

      <div>
        {blockReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block" tabIndex={0}>
                <Button variant="primary" size="block" disabled>
                  Start mirroring
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{blockReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="primary"
            size="block"
            disabled={pending}
            aria-busy={pending}
            aria-keyshortcuts="Control+Enter"
            onClick={() => (running && selectedDevice ? onStop(selectedDevice.serial) : onStart())}
          >
            {pending ? 'Starting…' : running ? 'Stop mirroring' : 'Start mirroring'}
          </Button>
        )}
        {blockReason && <p className="mt-2 text-sm text-muted-foreground">{blockReason}</p>}
        {!blockReason && !running && (
          <p className="mt-2 text-sm text-muted-foreground">Ctrl+Enter starts the selected phone.</p>
        )}
      </div>

      {readyCount >= 2 && !running && (
        <Button variant="ghost" className="justify-start px-1" disabled={Boolean(blockReason) || pending} onClick={onStartAll}>
          Mirror every ready phone
        </Button>
      )}

      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Command</h3>
          <CopyButton text={copyCommand} />
        </div>
        {command ? (
          <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-5" title={copyCommand ?? undefined}>
            {command}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{built.ok ? '' : built.error}</p>
        )}
      </div>
    </section>
  )
}

function EmptyState({ onWifi }: { onWifi: () => void }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className="text-[28px] font-semibold leading-9">No phone connected</h3>
      <p className="mt-2 text-sm text-muted-foreground">Turn on USB debugging, then plug the phone in.</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>On the phone, open Settings, then About phone. Tap Build number seven times.</li>
        <li>Open Settings, then System, then Developer options. Turn on USB debugging.</li>
        <li>Plug in the USB cable. If the phone asks, tap Allow.</li>
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">Menu names differ on some phones. The switch is always called USB debugging.</p>
      <Button className="mt-4" variant="secondary" onClick={onWifi}>
        Connect over Wi-Fi
      </Button>
    </div>
  )
}

function DeviceList({
  devices,
  selected,
  sessions,
  onSelect,
  onStop,
  onDisconnect,
}: {
  devices: Device[]
  selected: string | null
  sessions: SessionInfo[]
  onSelect: (serial: string) => void
  onStop: (serial: string) => void
  onDisconnect: (serial: string) => void
}) {
  const selectedIndex = devices.findIndex((device) => device.serial === selected)

  function move(nextIndex: number) {
    const device = devices[nextIndex]
    if (!device) return
    onSelect(device.serial)
    document.getElementById(`device-${device.serial}`)?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Connected phones"
      className="grid gap-2"
      onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        if (selectedIndex < 0) {
          move(0)
          return
        }
        if (event.key === 'Home') move(0)
        else if (event.key === 'End') move(devices.length - 1)
        else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(Math.min(devices.length - 1, selectedIndex + 1))
        else move(Math.max(0, selectedIndex - 1))
      }}
    >
      {devices.map((device) => {
        const isSelected = device.serial === selected
        const mirroring = sessions.some((session) => session.serial === device.serial && session.running)
        const status = statusLabel(device, mirroring)
        const tone =
          status.tone === 'success'
            ? 'text-success'
            : status.tone === 'warning'
              ? 'text-warning'
              : status.tone === 'danger'
                ? 'text-destructive'
                : 'text-muted-foreground'
        return (
          <div
            key={device.serial}
            className="rounded-md bg-card px-3 py-3"
            style={{ boxShadow: isSelected ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px var(--border)' }}
          >
            <button
              id={`device-${device.serial}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (selectedIndex < 0 && device === devices[0]) ? 0 : -1}
              className="block w-full text-left"
              onClick={() => onSelect(device.serial)}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold" title={device.model}>
                  {device.model}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">{connectionLabel(device)}</span>
              </span>
              <span className={`mt-1 block text-sm ${tone}`}>
                {status.text}
                {device.connection === 'wifi' ? ` · ${device.serial}` : ''}
              </span>
            </button>
            {(mirroring && !isSelected) || device.connection === 'wifi' ? (
              <div className="mt-2 flex gap-2">
                {mirroring && !isSelected && (
                  <Button size="sm" variant="secondary" onClick={() => onStop(device.serial)}>
                    Stop
                  </Button>
                )}
                {device.connection === 'wifi' && (
                  <Button size="sm" variant="ghost" onClick={() => onDisconnect(device.serial)}>
                    Disconnect
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function CopyButton({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={!text}
      onClick={() => {
        if (!text || !window.phoneMirror) return
        void window.phoneMirror.copyText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        })
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}
