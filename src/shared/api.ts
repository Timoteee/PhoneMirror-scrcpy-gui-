import type { ActionResult, Bootstrap, DeviceSnapshot, LogLine, MirrorSettings, Profile, SessionInfo, ThemeChoice } from './types'

export interface StartMirrorPayload {
  serial: string
  settings: MirrorSettings
}

export interface WifiConnectPayload {
  host: string
  port: string
}

export interface WifiPairPayload {
  host: string
  pairPort: string
  code: string
  connectPort: string
}

export interface WifiTcpipPayload {
  serial: string
  port: string
}

export interface ConfigPatch {
  theme?: ThemeChoice
  activeProfileId?: string
  settings?: MirrorSettings
}

export interface PhoneMirrorApi {
  bootstrap: () => Promise<Bootstrap>
  refreshDevices: () => Promise<DeviceSnapshot>
  onDevices: (cb: (snapshot: DeviceSnapshot) => void) => () => void
  onLog: (cb: (line: LogLine) => void) => () => void
  onSession: (cb: (sessions: SessionInfo[]) => void) => () => void
  onSystemTheme: (cb: (dark: boolean) => void) => () => void
  startMirror: (payload: StartMirrorPayload) => Promise<ActionResult>
  stopMirror: (serial: string) => Promise<ActionResult>
  startAll: (settings: MirrorSettings) => Promise<ActionResult>
  pickRecord: (suggestedName: string) => Promise<string | null>
  wifiConnect: (payload: WifiConnectPayload) => Promise<ActionResult>
  wifiPair: (payload: WifiPairPayload) => Promise<ActionResult>
  wifiTcpip: (payload: WifiTcpipPayload) => Promise<ActionResult>
  wifiDisconnect: (serial: string) => Promise<ActionResult>
  saveConfig: (patch: ConfigPatch) => Promise<void>
  saveProfile: (input: { id?: string; name: string; settings: MirrorSettings }) => Promise<Profile[] | { error: string }>
  deleteProfile: (id: string) => Promise<Profile[]>
  pickScrcpy: () => Promise<{ path: string | null; version?: string | null; error?: string }>
  resetScrcpy: () => Promise<{ path: string | null; version: string | null; error: string | null }>
  readLicense: () => Promise<string>
  copyText: (text: string) => Promise<void>
  captureShot: (name: string) => Promise<void>
  finishShots: () => Promise<void>
}
