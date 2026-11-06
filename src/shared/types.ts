export const VIDEO_CODECS = ['h264', 'h265', 'av1'] as const
export const AUDIO_SOURCES = ['output', 'playback', 'mic', 'voice-call'] as const
export const INPUT_MODES = ['sdk', 'uhid', 'aoa', 'disabled'] as const
export const CAMERA_FACINGS = ['back', 'front', 'external'] as const
export const VIRTUAL_DISPLAYS = ['off', 'device', 'custom'] as const
export const ORIENTATIONS = ['follow', 'lock', '0', '90', '180', '270'] as const
export const VIDEO_SOURCES = ['display', 'camera'] as const
export const THEMES = ['system', 'light', 'dark'] as const

export type VideoCodec = (typeof VIDEO_CODECS)[number]
export type AudioSource = (typeof AUDIO_SOURCES)[number]
export type InputMode = (typeof INPUT_MODES)[number]
export type CameraFacing = (typeof CAMERA_FACINGS)[number]
export type VirtualDisplay = (typeof VIRTUAL_DISPLAYS)[number]
export type OrientationChoice = (typeof ORIENTATIONS)[number]
export type VideoSource = (typeof VIDEO_SOURCES)[number]
export type ThemeChoice = (typeof THEMES)[number]

export interface MirrorSettings {
  maxSize: number
  videoBitRate: string
  maxFps: number
  videoCodec: VideoCodec
  audioEnabled: boolean
  audioSource: AudioSource
  audioDup: boolean
  stayAwake: boolean
  turnScreenOff: boolean
  showTouches: boolean
  alwaysOnTop: boolean
  fullscreen: boolean
  borderless: boolean
  recordEnabled: boolean
  recordPath: string
  readOnly: boolean
  keyboard: InputMode
  mouse: InputMode
  videoSource: VideoSource
  cameraFacing: CameraFacing
  virtualDisplay: VirtualDisplay
  virtualWidth: number
  virtualHeight: number
  virtualDpi: number
  orientation: OrientationChoice
}

export type DeviceState =
  | 'device'
  | 'unauthorized'
  | 'offline'
  | 'authorizing'
  | 'connecting'
  | 'unknown'

export type DeviceConnection = 'usb' | 'wifi' | 'emulator'

export interface Device {
  serial: string
  state: DeviceState
  model: string
  connection: DeviceConnection
}

export interface DeviceSnapshot {
  devices: Device[]
  error: string | null
}

export interface Profile {
  id: string
  name: string
  builtIn: boolean
  settings: MirrorSettings
}

export interface SessionInfo {
  serial: string
  model: string
  running: boolean
  startedAt: number
}

export interface LogLine {
  id: number
  ts: number
  level: 'info' | 'error' | 'system'
  source: string
  text: string
}

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

export interface Bootstrap {
  scrcpyPath: string | null
  scrcpyVersion: string | null
  scrcpyCustom: boolean
  scrcpyError: string | null
  theme: ThemeChoice
  systemDark: boolean
  activeProfileId: string
  settings: MirrorSettings
  profiles: Profile[]
  screenshot: boolean
}
