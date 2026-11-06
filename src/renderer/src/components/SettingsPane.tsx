import { settingsEqual } from '@shared/settings'
import type { MirrorSettings, Profile } from '@shared/types'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { HelpButton } from '@/components/HelpButton'
import { Segmented } from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { captureSummary, inputSummary, pictureSummary, soundSummary, windowSummary } from '@/lib/labels'
import { cn } from '@/lib/utils'

type GroupId = 'picture' | 'sound' | 'window' | 'input' | 'capture' | 'advanced'

const SIZES = ['0', '1920', '1280', '1024', '800']
const RATES = ['2M', '4M', '8M', '16M', '32M']
const RATES_FPS = ['0', '60', '30', '15']

export function SettingsPane({
  settings,
  onChange,
  profiles,
  activeProfileId,
  onApplyProfile,
  onSaveProfile,
  onDeleteProfile,
  onPickRecord,
  scrcpyPath,
  scrcpyVersion,
  scrcpyCustom,
  onPickScrcpy,
  onResetScrcpy,
  onAbout,
  forcedOpen,
}: {
  settings: MirrorSettings
  onChange: (settings: MirrorSettings) => void
  profiles: Profile[]
  activeProfileId: string
  onApplyProfile: (id: string) => void
  onSaveProfile: (input: { id?: string; name: string }) => Promise<string | null>
  onDeleteProfile: (id: string) => void
  onPickRecord: () => void
  scrcpyPath: string | null
  scrcpyVersion: string | null
  scrcpyCustom: boolean
  onPickScrcpy: () => void
  onResetScrcpy: () => void
  onAbout: () => void
  forcedOpen: GroupId[]
}) {
  const [open, setOpen] = useState<Partial<Record<GroupId, boolean>>>({})
  const [saveOpen, setSaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetError, setPresetError] = useState<string | null>(null)
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0]
  const modified = active ? !settingsEqual(settings, active.settings) : false
  const forcedKey = forcedOpen.join('|')

  useEffect(() => {
    if (!forcedKey) {
      setOpen({})
      return
    }
    const next: Partial<Record<GroupId, boolean>> = {}
    for (const id of forcedKey.split('|')) next[id as GroupId] = true
    setOpen(next)
  }, [forcedKey])

  useEffect(() => {
    if (settings.recordEnabled && !settings.recordPath) {
      setOpen((current) => ({ ...current, capture: true }))
    }
  }, [settings.recordEnabled, settings.recordPath])

  function patch(partial: Partial<MirrorSettings>) {
    onChange({ ...settings, ...partial })
  }

  const sizeValue = SIZES.includes(String(settings.maxSize)) ? String(settings.maxSize) : 'custom'
  const rateValue = RATES.includes(settings.videoBitRate) ? settings.videoBitRate : 'custom'
  const fpsValue = RATES_FPS.includes(String(settings.maxFps)) ? String(settings.maxFps) : 'custom'
  const source = settings.videoSource === 'camera' ? 'camera' : settings.virtualDisplay !== 'off' ? 'virtual' : 'display'

  return (
    <section className="min-h-0 flex-1 overflow-auto border-t border-border p-6 min-[860px]:border-l min-[860px]:border-t-0" aria-labelledby="options-heading">
      <div className="mx-auto grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="options-heading" className="text-base font-semibold">
            Mirroring options
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Preset</span>
              <select
                className="h-8 rounded-sm border border-border bg-card px-2"
                value={active?.id ?? ''}
                onChange={(event) => onApplyProfile(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            {modified && (
              <Button size="sm" variant="secondary" onClick={() => { setPresetName(''); setPresetError(null); setSaveOpen(true) }}>
                Save as new preset
              </Button>
            )}
            {modified && active && !active.builtIn && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void onSaveProfile({ id: active.id, name: active.name }).then((error) => setPresetError(error))
                }}
              >
                Save changes
              </Button>
            )}
            {modified && active && (
              <Button size="sm" variant="ghost" onClick={() => onApplyProfile(active.id)}>
                Revert
              </Button>
            )}
            {active && !active.builtIn && !modified && (
              <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
                Delete preset
              </Button>
            )}
          </div>
        </div>
        {modified && <p className="text-sm text-muted-foreground">Unsaved changes to {active?.name ?? 'this preset'}.</p>}
        {presetError && (
          <p role="alert" className="text-sm text-destructive">
            {presetError}
          </p>
        )}

        <Disclosure id="picture" title="Picture" summary={pictureSummary(settings)} open={Boolean(open.picture)} onToggle={() => setOpen((c) => ({ ...c, picture: !c.picture }))}>
          <Field label="Max resolution" hint="Limits the longer side of the video (--max-size). Native keeps the phone's resolution. Lower values are smoother on a slow cable or Wi-Fi.">
            <Segmented
              label="Max resolution"
              value={sizeValue}
              onChange={(value) => patch({ maxSize: value === 'custom' ? (settings.maxSize || 1600) : Number(value) })}
              options={[
                { value: '0', label: 'Native' },
                { value: '1920', label: '1920' },
                { value: '1280', label: '1280' },
                { value: '1024', label: '1024' },
                { value: '800', label: '800' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            {sizeValue === 'custom' && (
              <NumberField label="Custom max resolution" value={settings.maxSize || 1600} min={160} max={8192} suffix="px" onChange={(maxSize) => patch({ maxSize })} />
            )}
          </Field>
          <Field label="Bitrate (Mbps)" hint="Video quality in megabits per second (--video-bit-rate). 8 is scrcpy's default. Lower is more responsive.">
            <Segmented
              label="Bitrate"
              value={rateValue}
              onChange={(value) => patch({ videoBitRate: value === 'custom' ? (RATES.includes(settings.videoBitRate) ? '12M' : settings.videoBitRate) : value })}
              options={[
                { value: '2M', label: '2' },
                { value: '4M', label: '4' },
                { value: '8M', label: '8' },
                { value: '16M', label: '16' },
                { value: '32M', label: '32' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            {rateValue === 'custom' && (
              <NumberField
                label="Custom bitrate in megabits per second"
                value={Number(settings.videoBitRate.replace('M', '')) || 12}
                min={1}
                max={100}
                suffix="Mbps"
                onChange={(n) => patch({ videoBitRate: `${n}M` })}
              />
            )}
          </Field>
          <Field label="Frame rate" hint="Caps frames per second (--max-fps). Unlimited lets the phone choose.">
            <Segmented
              label="Frame rate"
              value={fpsValue}
              onChange={(value) => patch({ maxFps: value === 'custom' ? (settings.maxFps || 60) : Number(value) })}
              options={[
                { value: '0', label: 'Unlimited' },
                { value: '60', label: '60' },
                { value: '30', label: '30' },
                { value: '15', label: '15' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            {fpsValue === 'custom' && (
              <NumberField label="Custom frame rate" value={settings.maxFps || 60} min={1} max={240} suffix="fps" onChange={(maxFps) => patch({ maxFps })} />
            )}
          </Field>
          <Field label="Video codec" hint="H.264 works on the most phones (--video-codec). H.265 and AV1 can look better at the same bitrate when the phone supports them.">
            <Segmented
              label="Video codec"
              value={settings.videoCodec}
              onChange={(videoCodec) => patch({ videoCodec })}
              options={[
                { value: 'h264', label: 'H.264' },
                { value: 'h265', label: 'H.265' },
                { value: 'av1', label: 'AV1' },
              ]}
            />
          </Field>
        </Disclosure>

        <Disclosure id="sound" title="Sound" summary={soundSummary(settings)} open={Boolean(open.sound)} onToggle={() => setOpen((c) => ({ ...c, sound: !c.sound }))}>
          <ToggleRow label="Play sound on this PC" hint="Sends the phone's audio here. Turn this off for lower latency (--no-audio). Audio needs Android 11 or newer." checked={settings.audioEnabled} onCheckedChange={(audioEnabled) => patch({ audioEnabled })} />
          <Field label="Audio source" hint="What to capture (--audio-source). Phone speakers is the whole mix and mutes the phone. Microphone uses the mic.">
            <Segmented
              label="Audio source"
              value={settings.audioDup ? 'playback' : settings.audioSource}
              disabled={!settings.audioEnabled || settings.audioDup}
              onChange={(audioSource) => patch({ audioSource, audioDup: false })}
              options={[
                { value: 'output', label: 'Phone speakers' },
                { value: 'playback', label: 'App playback' },
                { value: 'mic', label: 'Microphone' },
                { value: 'voice-call', label: 'Voice call' },
              ]}
            />
          </Field>
          <ToggleRow
            label="Also play on the phone"
            hint="Keeps sound playing on the phone (--audio-dup). Uses playback capture and needs Android 13 or newer. Some apps opt out."
            checked={settings.audioDup}
            onCheckedChange={(audioDup) => patch({ audioDup, audioEnabled: audioDup ? true : settings.audioEnabled, audioSource: audioDup ? 'playback' : settings.audioSource })}
          />
        </Disclosure>

        <Disclosure id="window" title="Window" summary={windowSummary(settings)} open={Boolean(open.window)} onToggle={() => setOpen((c) => ({ ...c, window: !c.window }))}>
          <ToggleRow label="Keep the phone awake" hint="While the phone is plugged in, the screen stays on (--stay-awake). It returns to normal when mirroring stops." checked={settings.stayAwake} onCheckedChange={(stayAwake) => patch({ stayAwake })} />
          <ToggleRow label="Turn the phone screen off" hint="The mirror stays on and the phone screen turns off (--turn-screen-off)." checked={settings.turnScreenOff} onCheckedChange={(turnScreenOff) => patch({ turnScreenOff })} />
          <ToggleRow label="Show touches" hint="Draws physical taps on the phone (--show-touches). Clicks from this PC are not drawn." checked={settings.showTouches} onCheckedChange={(showTouches) => patch({ showTouches })} />
          <ToggleRow label="Keep the mirror above other windows" hint="The scrcpy window stays on top (--always-on-top)." checked={settings.alwaysOnTop} onCheckedChange={(alwaysOnTop) => patch({ alwaysOnTop })} />
          <ToggleRow label="Start fullscreen" hint="Opens the mirror fullscreen (--fullscreen). F11 or Alt+F leaves fullscreen." checked={settings.fullscreen} onCheckedChange={(fullscreen) => patch({ fullscreen })} />
          <ToggleRow label="Hide the window border" hint="Opens the mirror without a title bar (--window-borderless)." checked={settings.borderless} onCheckedChange={(borderless) => patch({ borderless })} />
        </Disclosure>

        <Disclosure id="input" title="Input" summary={inputSummary(settings)} open={Boolean(open.input)} onToggle={() => setOpen((c) => ({ ...c, input: !c.input }))}>
          <ToggleRow label="View only" hint="You can see the phone but not control it (--no-control)." checked={settings.readOnly} onCheckedChange={(readOnly) => patch({ readOnly })} />
          <Field label="Keyboard" hint="How keystrokes are sent (--keyboard). Standard works everywhere. Physical acts like a hardware keyboard and needs a layout chosen on the phone. USB accessory only works over a cable.">
            <Segmented
              label="Keyboard"
              value={settings.keyboard}
              disabled={settings.readOnly}
              onChange={(keyboard) => patch({ keyboard })}
              options={[
                { value: 'sdk', label: 'Standard' },
                { value: 'uhid', label: 'Physical' },
                { value: 'aoa', label: 'USB accessory' },
                { value: 'disabled', label: 'Off' },
              ]}
            />
          </Field>
          <Field label="Mouse" hint="How pointer input is sent (--mouse). Standard clicks the screen. Captured mouse is relative, like a game; Left Alt or the Super key releases it. USB accessory only works over a cable.">
            <Segmented
              label="Mouse"
              value={settings.mouse}
              disabled={settings.readOnly}
              onChange={(mouse) => patch({ mouse })}
              options={[
                { value: 'sdk', label: 'Standard' },
                { value: 'uhid', label: 'Captured' },
                { value: 'aoa', label: 'USB accessory' },
                { value: 'disabled', label: 'Off' },
              ]}
            />
          </Field>
        </Disclosure>

        <Disclosure id="capture" title="Capture" summary={captureSummary(settings)} open={Boolean(open.capture)} onToggle={() => setOpen((c) => ({ ...c, capture: !c.capture }))}>
          <Field label="What to show" hint="Phone screen mirrors the display. Camera mirrors a camera (--video-source=camera, Android 12 or newer). Virtual display creates a second screen (--new-display).">
            <Segmented
              label="What to show"
              value={source}
              onChange={(value) => {
                if (value === 'display') patch({ videoSource: 'display', virtualDisplay: 'off' })
                if (value === 'camera') patch({ videoSource: 'camera', virtualDisplay: 'off' })
                if (value === 'virtual') patch({ videoSource: 'display', virtualDisplay: settings.virtualDisplay === 'custom' ? 'custom' : 'device' })
              }}
              options={[
                { value: 'display', label: 'Phone screen' },
                { value: 'camera', label: 'Camera' },
                { value: 'virtual', label: 'Virtual display' },
              ]}
            />
          </Field>
          {source === 'camera' && (
            <Field label="Camera" hint="Which camera to open (--camera-facing).">
              <Segmented
                label="Camera"
                value={settings.cameraFacing}
                onChange={(cameraFacing) => patch({ cameraFacing })}
                options={[
                  { value: 'back', label: 'Back' },
                  { value: 'front', label: 'Front' },
                  { value: 'external', label: 'External' },
                ]}
              />
            </Field>
          )}
          {source === 'virtual' && (
            <Field label="Virtual display size" hint="Same as phone uses the phone's size and density. Custom sets width, height, and dpi, for example 1920×1080 at 420 dpi.">
              <Segmented
                label="Virtual display size"
                value={settings.virtualDisplay === 'custom' ? 'custom' : 'device'}
                onChange={(value) => patch({ virtualDisplay: value === 'custom' ? 'custom' : 'device' })}
                options={[
                  { value: 'device', label: 'Same as phone' },
                  { value: 'custom', label: 'Custom' },
                ]}
              />
              {settings.virtualDisplay === 'custom' && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <NumberField label="Width" value={settings.virtualWidth} min={160} max={4096} suffix="px" onChange={(virtualWidth) => patch({ virtualWidth })} />
                  <NumberField label="Height" value={settings.virtualHeight} min={160} max={4096} suffix="px" onChange={(virtualHeight) => patch({ virtualHeight })} />
                  <NumberField label="Density" value={settings.virtualDpi} min={120} max={960} suffix="dpi" onChange={(virtualDpi) => patch({ virtualDpi })} />
                </div>
              )}
            </Field>
          )}
          <Field label="Orientation" hint="Locks the mirrored image (--capture-orientation). Follow the phone rotates with it. The degree choices are locked relative to the phone's natural orientation.">
            <Segmented
              label="Orientation"
              value={settings.orientation}
              onChange={(orientation) => patch({ orientation })}
              options={[
                { value: 'follow', label: 'Follow phone' },
                { value: 'lock', label: 'Lock current' },
                { value: '0', label: '0°' },
                { value: '90', label: '90°' },
                { value: '180', label: '180°' },
                { value: '270', label: '270°' },
              ]}
            />
          </Field>
          <ToggleRow label="Record to a file" hint="Writes the mirror to a video file (--record). mp4 and mkv are chosen by the file extension." checked={settings.recordEnabled} onCheckedChange={(recordEnabled) => patch({ recordEnabled })} />
          {settings.recordEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={onPickRecord}>
                Choose file
              </Button>
              <span className="min-w-0 break-all text-sm text-muted-foreground">{settings.recordPath || 'No file chosen yet'}</span>
            </div>
          )}
        </Disclosure>

        <Disclosure id="advanced" title="Advanced" summary={scrcpyCustom ? 'Custom scrcpy' : 'Bundled scrcpy'} open={Boolean(open.advanced)} onToggle={() => setOpen((c) => ({ ...c, advanced: !c.advanced }))}>
          <p className="text-sm text-muted-foreground">
            {scrcpyVersion ? `scrcpy ${scrcpyVersion}` : 'scrcpy version unknown'}. Phone Mirror runs the official build, which includes adb.
          </p>
          <p className="break-all font-mono text-[13px] leading-5" title={scrcpyPath ?? undefined}>
            {scrcpyPath ?? 'Not found'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onPickScrcpy}>
              Choose another scrcpy
            </Button>
            <Button variant="ghost" disabled={!scrcpyCustom} onClick={onResetScrcpy}>
              Use bundled
            </Button>
            <Button variant="ghost" onClick={onAbout}>
              View license
            </Button>
          </div>
        </Disclosure>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogTitle>Save preset</DialogTitle>
          <DialogDescription>Saves the current options on this PC.</DialogDescription>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void onSaveProfile({ name: presetName }).then((error) => {
                if (error) setPresetError(error)
                else setSaveOpen(false)
              })
            }}
          >
            <label className="grid gap-1 text-sm font-semibold" htmlFor="preset-name">
              Name
              <Input id="preset-name" value={presetName} maxLength={40} onChange={(event) => setPresetName(event.target.value)} autoFocus />
            </label>
            {presetError && saveOpen && (
              <p role="alert" className="text-sm text-destructive">
                {presetError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save preset
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogTitle>Delete {active?.name}?</DialogTitle>
          <DialogDescription>This removes the saved preset. The options on screen stay as they are.</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (active) onDeleteProfile(active.id)
                setDeleteOpen(false)
              }}
            >
              Delete preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Disclosure({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = `${id}-panel`
  return (
    <section className="rounded-md bg-card" style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}>
      <h3>
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
          <span className="shrink-0 font-semibold">{title}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{summary}</span>
          <ChevronDown className={cn('size-4 shrink-0', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={panelId} className="grid gap-4 border-t border-border px-4 py-4">
          {children}
        </div>
      )}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold">{label}</span>
        <HelpButton label={label} hint={hint} />
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string
  hint: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <HelpButton label={label} hint={hint} />
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          aria-label={label}
          value={text}
          onChange={(event) => {
            const next = event.target.value
            if (!/^\d{0,4}$/.test(next)) return
            setText(next)
            const parsed = Number(next)
            if (next && parsed >= min && parsed <= max) onChange(parsed)
          }}
          onBlur={() => setText(String(value))}
        />
        <span className="shrink-0 text-muted-foreground">{suffix}</span>
      </span>
    </label>
  )
}
