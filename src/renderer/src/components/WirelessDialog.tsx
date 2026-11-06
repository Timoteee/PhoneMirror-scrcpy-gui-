import type { ActionResult, Device } from '@shared/types'
import { useState, type ReactNode } from 'react'
import { Segmented } from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Task = 'connect' | 'pair' | 'tcpip'

export function WirelessDialog({
  open,
  task,
  onTask,
  onOpenChange,
  devices,
  selectedSerial,
  onDone,
}: {
  open: boolean
  task: Task
  onTask: (task: Task) => void
  onOpenChange: (open: boolean) => void
  devices: Device[]
  selectedSerial: string | null
  onDone: (result: ActionResult) => void
}) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('5555')
  const [pairPort, setPairPort] = useState('')
  const [code, setCode] = useState('')
  const [connectPort, setConnectPort] = useState('5555')
  const [tcpPort, setTcpPort] = useState('5555')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selected = devices.find((device) => device.serial === selectedSerial)
  const usb = selected?.connection === 'usb' && selected.state === 'device' ? selected : devices.find((device) => device.connection === 'usb' && device.state === 'device')

  async function submit() {
    if (!window.phoneMirror || busy) return
    setBusy(true)
    setError(null)
    const result =
      task === 'connect'
        ? await window.phoneMirror.wifiConnect({ host, port })
        : task === 'pair'
          ? await window.phoneMirror.wifiPair({ host, pairPort, code, connectPort })
          : await window.phoneMirror.wifiTcpip({ serial: usb?.serial ?? '', port: tcpPort })
    setBusy(false)
    if (result.ok) onDone(result)
    else setError(result.error)
  }

  const primary = task === 'connect' ? 'Connect' : task === 'pair' ? 'Pair and connect' : 'Switch to Wi-Fi'
  const tcpDisabled = task === 'tcpip' && !usb

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Connect over Wi-Fi</DialogTitle>
        <DialogDescription>The phone and this PC need to be on the same network.</DialogDescription>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Segmented
            label="Wireless task"
            value={task}
            onChange={(value) => {
              setError(null)
              onTask(value)
            }}
            options={[
              { value: 'connect', label: 'Connect' },
              { value: 'pair', label: 'Pair' },
              { value: 'tcpip', label: 'USB to Wi-Fi' },
            ]}
          />

          {task === 'connect' && (
            <>
              <p className="text-sm text-muted-foreground">Use this when the phone is already listening, usually on port 5555.</p>
              <AddressFields host={host} port={port} onHost={setHost} onPort={setPort} portLabel="Port" />
            </>
          )}

          {task === 'pair' && (
            <>
              <p className="text-sm text-muted-foreground">
                On the phone, open Developer options, then Wireless debugging, then Pair device with pairing code. Android 11 or newer.
              </p>
              <Field label="IP address" htmlFor="pair-host">
                <Input id="pair-host" inputMode="decimal" autoComplete="off" placeholder="192.168.1.20" value={host} onChange={(event) => setHost(event.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pairing port" htmlFor="pair-port">
                  <Input id="pair-port" inputMode="numeric" value={pairPort} onChange={(event) => setPairPort(event.target.value)} />
                </Field>
                <Field label="Pairing code" htmlFor="pair-code">
                  <Input id="pair-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />
                </Field>
              </div>
              <Field label="Connection port" htmlFor="connect-port">
                <Input id="connect-port" inputMode="numeric" value={connectPort} onChange={(event) => setConnectPort(event.target.value)} />
              </Field>
              <p className="text-sm text-muted-foreground">The connection port is on the Wireless debugging screen, under IP address and port. It is not the pairing port.</p>
            </>
          )}

          {task === 'tcpip' && (
            <>
              <p className="text-sm text-muted-foreground">
                Leave the phone plugged in and joined to Wi-Fi. Phone Mirror will ask it to listen, then connect. You can unplug the cable after the phone appears in the list.
              </p>
              <p className="text-sm">{usb ? `Using ${usb.model} over USB.` : 'Select a ready USB phone on the main screen first.'}</p>
              <Field label="Listen port" htmlFor="tcp-port">
                <Input id="tcp-port" inputMode="numeric" value={tcpPort} onChange={(event) => setTcpPort(event.target.value)} />
              </Field>
            </>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-destructive bg-[var(--danger-bg)] px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy || tcpDisabled} aria-busy={busy}>
              {busy ? 'Working…' : primary}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddressFields({
  host,
  port,
  onHost,
  onPort,
  portLabel,
}: {
  host: string
  port: string
  onHost: (value: string) => void
  onPort: (value: string) => void
  portLabel: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
      <Field label="IP address" htmlFor="wifi-host">
        <Input id="wifi-host" inputMode="decimal" autoComplete="off" placeholder="192.168.1.20" value={host} onChange={(event) => onHost(event.target.value)} />
      </Field>
      <Field label={portLabel} htmlFor="wifi-port">
        <Input id="wifi-port" inputMode="numeric" value={port} onChange={(event) => onPort(event.target.value)} />
      </Field>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold" htmlFor={htmlFor}>
      {label}
      {children}
    </label>
  )
}
