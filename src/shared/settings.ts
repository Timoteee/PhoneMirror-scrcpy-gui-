import {
  AUDIO_SOURCES,
  CAMERA_FACINGS,
  INPUT_MODES,
  ORIENTATIONS,
  THEMES,
  VIDEO_CODECS,
  VIDEO_SOURCES,
  VIRTUAL_DISPLAYS,
  type MirrorSettings,
  type ThemeChoice,
} from './types'

export const DEFAULT_SETTINGS: MirrorSettings = {
  maxSize: 0,
  videoBitRate: '8M',
  maxFps: 0,
  videoCodec: 'h264',
  audioEnabled: true,
  audioSource: 'output',
  audioDup: false,
  stayAwake: true,
  turnScreenOff: false,
  showTouches: false,
  alwaysOnTop: false,
  fullscreen: false,
  borderless: false,
  recordEnabled: false,
  recordPath: '',
  readOnly: false,
  keyboard: 'sdk',
  mouse: 'sdk',
  videoSource: 'display',
  cameraFacing: 'back',
  virtualDisplay: 'off',
  virtualWidth: 1920,
  virtualHeight: 1080,
  virtualDpi: 420,
  orientation: 'follow',
}

export function presetLowLatency(): MirrorSettings {
  return {
    ...DEFAULT_SETTINGS,
    maxSize: 1024,
    videoBitRate: '4M',
    maxFps: 60,
    audioEnabled: false,
    stayAwake: true,
  }
}

export function presetHighQuality(): MirrorSettings {
  return {
    ...DEFAULT_SETTINGS,
    maxSize: 0,
    videoBitRate: '16M',
    maxFps: 60,
    videoCodec: 'h265',
    audioEnabled: true,
    audioSource: 'output',
  }
}

export function presetRecording(): MirrorSettings {
  return {
    ...DEFAULT_SETTINGS,
    maxSize: 1920,
    videoBitRate: '12M',
    maxFps: 60,
    videoCodec: 'h264',
    audioEnabled: true,
    stayAwake: true,
    recordEnabled: true,
  }
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

function isBool(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isBitrate(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[1-9]\d{0,2})M$/.test(value)
}

export function isSafeSerial(serial: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(serial)
}

export function isSafeAbsolutePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.length > 1024) return false
  if (/[\u0000-\u001F]/.test(filePath)) return false
  if (/^[a-zA-Z]:[\\/]/.test(filePath)) return true
  if (filePath.startsWith('\\\\')) return true
  if (filePath.startsWith('/')) return true
  return false
}

export function isIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!match) return false
  return match.slice(1).every((part) => {
    const n = Number(part)
    return n >= 0 && n <= 255 && String(n) === part
  })
}

export function validateHostPort(
  host: string,
  portRaw: string,
): { host: string; port: number } | { error: string } {
  const trimmed = host.trim()
  if (!isIpv4(trimmed)) {
    return { error: 'Enter an IP address, such as 192.168.1.20.' }
  }
  if (!/^\d{1,5}$/.test(portRaw.trim())) {
    return { error: 'Port must be a number from 1 to 65535.' }
  }
  const port = Number(portRaw.trim())
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'Port must be a number from 1 to 65535.' }
  }
  return { host: trimmed, port }
}

export function validatePairingCode(code: string): { code: string } | { error: string } {
  const digits = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(digits)) {
    return { error: 'Enter the 6-digit pairing code shown on the phone.' }
  }
  return { code: digits }
}

export function validateProfileName(name: string): { name: string } | { error: string } {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 40) {
    return { error: 'Preset name must be between 1 and 40 characters.' }
  }
  if (/[\u0000-\u001F]/.test(trimmed)) {
    return { error: 'Preset name cannot include line breaks.' }
  }
  return { name: trimmed }
}

export function parseSettings(value: unknown): MirrorSettings | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.maxSize !== 'number' || !Number.isFinite(v.maxSize)) return null
  if (!isBitrate(v.videoBitRate)) return null
  if (typeof v.maxFps !== 'number' || !Number.isFinite(v.maxFps)) return null
  if (!oneOf(v.videoCodec, VIDEO_CODECS)) return null
  if (!isBool(v.audioEnabled) || !isBool(v.audioDup)) return null
  if (!oneOf(v.audioSource, AUDIO_SOURCES)) return null
  if (
    !isBool(v.stayAwake) ||
    !isBool(v.turnScreenOff) ||
    !isBool(v.showTouches) ||
    !isBool(v.alwaysOnTop) ||
    !isBool(v.fullscreen) ||
    !isBool(v.borderless) ||
    !isBool(v.recordEnabled) ||
    !isBool(v.readOnly)
  ) {
    return null
  }
  if (typeof v.recordPath !== 'string') return null
  if (!oneOf(v.keyboard, INPUT_MODES) || !oneOf(v.mouse, INPUT_MODES)) return null
  if (!oneOf(v.videoSource, VIDEO_SOURCES)) return null
  if (!oneOf(v.cameraFacing, CAMERA_FACINGS)) return null
  if (!oneOf(v.virtualDisplay, VIRTUAL_DISPLAYS)) return null
  if (typeof v.virtualWidth !== 'number' || typeof v.virtualHeight !== 'number' || typeof v.virtualDpi !== 'number') {
    return null
  }
  if (!oneOf(v.orientation, ORIENTATIONS)) return null

  return {
    maxSize: v.maxSize,
    videoBitRate: v.videoBitRate,
    maxFps: v.maxFps,
    videoCodec: v.videoCodec,
    audioEnabled: v.audioEnabled,
    audioSource: v.audioSource,
    audioDup: v.audioDup,
    stayAwake: v.stayAwake,
    turnScreenOff: v.turnScreenOff,
    showTouches: v.showTouches,
    alwaysOnTop: v.alwaysOnTop,
    fullscreen: v.fullscreen,
    borderless: v.borderless,
    recordEnabled: v.recordEnabled,
    recordPath: v.recordPath,
    readOnly: v.readOnly,
    keyboard: v.keyboard,
    mouse: v.mouse,
    videoSource: v.videoSource,
    cameraFacing: v.cameraFacing,
    virtualDisplay: v.virtualDisplay,
    virtualWidth: v.virtualWidth,
    virtualHeight: v.virtualHeight,
    virtualDpi: v.virtualDpi,
    orientation: v.orientation,
  }
}

function bitrateMbps(value: string): number | null {
  const match = /^([1-9]\d{0,2})M$/.exec(value)
  if (!match) return null
  return Number(match[1])
}

export function validateSettings(settings: MirrorSettings): string | null {
  const sizeOk = settings.maxSize === 0 || (Number.isInteger(settings.maxSize) && settings.maxSize >= 160 && settings.maxSize <= 8192)
  if (!sizeOk) return 'Max resolution must be Native or a whole number from 160 to 8192.'

  const mbps = bitrateMbps(settings.videoBitRate)
  if (mbps === null || mbps < 1 || mbps > 100) return 'Bitrate must be a whole number of megabits from 1 to 100.'

  const fpsOk = settings.maxFps === 0 || (Number.isInteger(settings.maxFps) && settings.maxFps >= 1 && settings.maxFps <= 240)
  if (!fpsOk) return 'Frame rate must be unlimited or a whole number from 1 to 240.'

  if (settings.recordPath.length > 1024 || /[\u0000-\u001F]/.test(settings.recordPath)) {
    return 'Choose a recording file again.'
  }
  if (settings.recordEnabled && !isSafeAbsolutePath(settings.recordPath)) {
    return 'Choose a file to record to.'
  }

  if (settings.virtualDisplay === 'custom') {
    const dim = (n: number) => Number.isInteger(n) && n >= 160 && n <= 4096
    if (!dim(settings.virtualWidth) || !dim(settings.virtualHeight)) {
      return 'Virtual display size must be between 160 and 4096.'
    }
    if (!Number.isInteger(settings.virtualDpi) || settings.virtualDpi < 120 || settings.virtualDpi > 960) {
      return 'Virtual display density must be between 120 and 960 dpi.'
    }
  }

  return null
}

export function settingsFromDisk(value: unknown): MirrorSettings {
  const parsed = parseSettings(value)
  if (!parsed) return structuredClone(DEFAULT_SETTINGS)
  if (validateSettings(parsed)) return structuredClone(DEFAULT_SETTINGS)
  return parsed
}

export function settingsEqual(a: MirrorSettings, b: MirrorSettings): boolean {
  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof MirrorSettings)[]
  return keys.every((key) => a[key] === b[key])
}

export function parseTheme(value: unknown): ThemeChoice {
  return oneOf(value, THEMES) ? value : 'system'
}
