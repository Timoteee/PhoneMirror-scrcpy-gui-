import type { ActionResult, Bootstrap, DeviceSnapshot, LogLine, MirrorSettings, Profile, SessionInfo, ThemeChoice } from '@shared/types'
import { useEffect, useState } from 'react'
import { AboutDialog } from '@/components/AboutDialog'
import { DevicePane } from '@/components/DevicePane'
import { LogPane } from '@/components/LogPane'
import { SettingsPane } from '@/components/SettingsPane'
import { WirelessDialog } from '@/components/WirelessDialog'
import { Button } from '@/components/ui/button'
import { SHOTS, SAMPLE_DEVICES, sampleLog, type ShotStep } from '@/screenshot'

const emptySnapshot: DeviceSnapshot = { devices: [], error: null }

export function App() {
  const api = window.phoneMirror
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [theme, setTheme] = useState<ThemeChoice>('system')
  const [settings, setSettings] = useState<MirrorSettings | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState('everyday')
  const [snapshot, setSnapshot] = useState<DeviceSnapshot>(emptySnapshot)
  const [selected, setSelected] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [lines, setLines] = useState<LogLine[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState(false)
  const [wirelessOpen, setWirelessOpen] = useState(false)
  const [wirelessTask, setWirelessTask] = useState<'connect' | 'pair' | 'tcpip'>('connect')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [live, setLive] = useState('')
  const [ready, setReady] = useState(false)
  const [scrcpyPath, setScrcpyPath] = useState<string | null>(null)
  const [scrcpyVersion, setScrcpyVersion] = useState<string | null>(null)
  const [scrcpyCustom, setScrcpyCustom] = useState(false)
  const [forcedOpen, setForcedOpen] = useState<ShotStep['expand']>([])

  useEffect(() => {
    if (!api) return
    let cancel = false
    void api.bootstrap().then((data) => {
      if (cancel) return
      setBoot(data)
      setTheme(data.theme)
      setSettings(data.settings)
      setProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
      setScrcpyPath(data.scrcpyPath)
      setScrcpyVersion(data.scrcpyVersion)
      setScrcpyCustom(data.scrcpyCustom)
      if (data.scrcpyError) setSnapshot({ devices: [], error: data.scrcpyError })
      setLoading(!data.screenshot)
      setReady(true)
    })
    return () => {
      cancel = true
    }
  }, [api])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'light') root.classList.add('light')
    if (theme === 'dark') root.classList.add('dark')
  }, [theme])

  useEffect(() => {
    if (!api || !ready || boot?.screenshot) return
    const timer = window.setTimeout(() => {
      if (settings) void api.saveConfig({ theme, activeProfileId, settings })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [api, theme, activeProfileId, settings, ready, boot?.screenshot])

  useEffect(() => {
    if (!api || !ready || boot?.screenshot) return
    void api.refreshDevices().then((next) => {
      setSnapshot(next)
      setLoading(false)
    })
    const stopDevices = api.onDevices((next) => {
      setSnapshot((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
      setLoading(false)
      setRefreshing(false)
    })
    const stopSessions = api.onSession(setSessions)
    const stopLogs = api.onLog((line) => {
      setLines((current) => [...current, line].slice(-400))
      if (line.level === 'error') {
        setLogOpen(true)
        setBanner({ tone: 'danger', text: line.text })
        setLive(line.text)
      }
    })
    return () => {
      stopDevices()
      stopSessions()
      stopLogs()
    }
  }, [api, ready, boot?.screenshot])

  useEffect(() => {
    setSelected((current) => {
      if (current && snapshot.devices.some((device) => device.serial === current)) return current
      return snapshot.devices.find((device) => device.state === 'device')?.serial ?? snapshot.devices[0]?.serial ?? null
    })
  }, [snapshot.devices])

  useEffect(() => {
    if (!boot?.screenshot || !api) return
    let cancel = false
    void (async () => {
      await document.fonts.ready
      for (const step of SHOTS) {
        if (cancel) return
        setTheme(step.theme)
        setWirelessOpen(step.wireless)
        setWirelessTask(step.wireless ? 'pair' : 'connect')
        setLogOpen(step.log)
        setForcedOpen(step.expand)
        setLines(step.log ? sampleLog() : [])
        setBanner(null)
        if (step.devices === 'sample') {
          setSnapshot({ devices: SAMPLE_DEVICES, error: null })
          setSelected('R5CW123ABC')
        } else {
          setSnapshot({ devices: [], error: null })
          setSelected(null)
        }
        setLoading(false)
        await wait(500)
        if (cancel) return
        await api.captureShot(step.name)
      }
      if (!cancel) await api.finishShots()
    })()
    return () => {
      cancel = true
    }
  }, [boot?.screenshot, api])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F5') {
        event.preventDefault()
        refresh()
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        if (document.querySelector('[role="dialog"]')) return
        event.preventDefault()
        const device = snapshot.devices.find((item) => item.serial === selected)
        const running = sessions.some((session) => session.serial === selected && session.running)
        if (running && selected) void stop(selected)
        else if (device?.state === 'device') void start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function refresh() {
    if (!api || boot?.screenshot) return
    setRefreshing(true)
    void api.refreshDevices().then((next) => {
      setSnapshot(next)
      setRefreshing(false)
      setLoading(false)
    })
  }

  async function start() {
    if (!api || !selected || !settings) return
    setPending(true)
    const result = await api.startMirror({ serial: selected, settings })
    setPending(false)
    if (!result.ok) {
      setBanner({ tone: 'danger', text: result.error })
      setLogOpen(true)
      setLive(result.error)
    } else {
      setLive(result.message ?? 'Mirroring started.')
    }
  }

  async function stop(serial: string) {
    if (!api) return
    const result = await api.stopMirror(serial)
    if (!result.ok) setBanner({ tone: 'danger', text: result.error })
  }

  async function startAll() {
    if (!api || !settings) return
    setPending(true)
    const result = await api.startAll(settings)
    setPending(false)
    if (!result.ok) setBanner({ tone: 'danger', text: result.error })
    else setBanner({ tone: 'success', text: result.message ?? 'Started mirroring.' })
  }

  function applyProfile(id: string) {
    const profile = profiles.find((item) => item.id === id)
    if (!profile) return
    setActiveProfileId(id)
    setSettings(structuredClone(profile.settings))
  }

  async function saveProfile(input: { id?: string; name: string }) {
    if (!api || !settings) return 'Could not save that preset.'
    const previous = new Set(profiles.map((profile) => profile.id))
    const result = await api.saveProfile({ ...input, settings })
    if ('error' in result) return result.error
    setProfiles(result)
    if (!input.id) {
      const created = result.find((profile) => !profile.builtIn && !previous.has(profile.id))
      if (created) setActiveProfileId(created.id)
    }
    return null
  }

  function deleteProfile(id: string) {
    if (!api) return
    void api.deleteProfile(id).then((next) => {
      setProfiles(next)
      if (activeProfileId === id) applyFrom(next, 'everyday')
    })
  }

  function applyFrom(next: Profile[], id: string) {
    const profile = next.find((item) => item.id === id)
    setActiveProfileId(id)
    if (profile) setSettings(structuredClone(profile.settings))
  }

  function onWifiDone(result: ActionResult) {
    setWirelessOpen(false)
    if (result.ok) {
      const text = result.message ?? 'Connected.'
      setBanner({ tone: 'success', text })
      setLive(text)
    }
  }

  if (!api) return <p className="p-6">Open Phone Mirror as a desktop app.</p>
  if (!boot || !settings) {
    return (
      <div className="grid h-full place-items-center bg-background text-sm text-foreground" role="status">
        Loading Phone Mirror…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <a className="skip-link" href="#phones">
        Skip to phones
      </a>
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <PhoneMark />
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-7">Phone Mirror</h1>
            <p className="text-sm text-muted-foreground">Show an Android phone on this PC</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{scrcpyVersion ? `scrcpy ${scrcpyVersion}` : 'scrcpy not found'}</span>
          <Button size="sm" variant="ghost" onClick={() => setAboutOpen(true)}>
            About
          </Button>
          <label>
            <span className="sr-only">Theme</span>
            <select
              className="h-8 rounded-sm border border-border bg-card px-2 text-sm"
              value={theme}
              onChange={(event) => setTheme(event.target.value as ThemeChoice)}
            >
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col min-[860px]:flex-row">
        <DevicePane
          devices={snapshot.devices}
          error={snapshot.error}
          loading={loading}
          selected={selected}
          onSelect={setSelected}
          sessions={sessions}
          pending={pending}
          settings={settings}
          scrcpyPath={scrcpyPath}
          refreshing={refreshing}
          onRefresh={refresh}
          onWifi={() => {
            setWirelessTask('connect')
            setWirelessOpen(true)
          }}
          onStart={() => void start()}
          onStop={(serial) => void stop(serial)}
          onStartAll={() => void startAll()}
          onDisconnect={(serial) => {
            void api.wifiDisconnect(serial).then((result) => {
              if (result.ok) setBanner({ tone: 'success', text: result.message ?? 'Disconnected.' })
              else setBanner({ tone: 'danger', text: result.error })
            })
          }}
          banner={banner}
        />
        <SettingsPane
          settings={settings}
          onChange={setSettings}
          profiles={profiles}
          activeProfileId={activeProfileId}
          onApplyProfile={applyProfile}
          onSaveProfile={saveProfile}
          onDeleteProfile={deleteProfile}
          onPickRecord={() => {
            const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
            void api.pickRecord(`PhoneMirror-${stamp}.mp4`).then((file) => {
              if (file) setSettings((current) => (current ? { ...current, recordEnabled: true, recordPath: file } : current))
            })
          }}
          scrcpyPath={scrcpyPath}
          scrcpyVersion={scrcpyVersion}
          scrcpyCustom={scrcpyCustom}
          onPickScrcpy={() => {
            void api.pickScrcpy().then((result) => {
              if (result.error) setBanner({ tone: 'danger', text: result.error })
              if (result.path) {
                setScrcpyPath(result.path)
                setScrcpyCustom(true)
                if (result.version) setScrcpyVersion(result.version)
              }
            })
          }}
          onResetScrcpy={() => {
            void api.resetScrcpy().then((result) => {
              setScrcpyPath(result.path)
              setScrcpyVersion(result.version)
              setScrcpyCustom(false)
              if (result.error) setBanner({ tone: 'danger', text: result.error })
            })
          }}
          onAbout={() => setAboutOpen(true)}
          forcedOpen={forcedOpen}
        />
      </div>

      <LogPane lines={lines} open={logOpen} onToggle={() => setLogOpen((open) => !open)} />

      <WirelessDialog
        open={wirelessOpen}
        task={wirelessTask}
        onTask={setWirelessTask}
        onOpenChange={setWirelessOpen}
        devices={snapshot.devices}
        selectedSerial={selected}
        onDone={onWifiDone}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} version={scrcpyVersion} />
      <div className="sr-only" aria-live="polite">
        {live}
      </div>
    </div>
  )
}

function PhoneMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0 text-foreground">
      <rect x="8" y="2" width="12" height="24" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.5" y="5.5" width="7" height="13" rx="0.5" fill="currentColor" />
    </svg>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
