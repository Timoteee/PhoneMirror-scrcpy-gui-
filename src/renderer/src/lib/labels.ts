import type { Device, MirrorSettings } from '@shared/types'

const CODECS: Record<MirrorSettings['videoCodec'], string> = {
  h264: 'H.264',
  h265: 'H.265',
  av1: 'AV1',
}

const AUDIO: Record<MirrorSettings['audioSource'], string> = {
  output: 'Phone speakers',
  playback: 'App playback',
  mic: 'Microphone',
  'voice-call': 'Voice call',
}

const KEYS: Record<MirrorSettings['keyboard'], string> = {
  sdk: 'Standard keyboard',
  uhid: 'Physical keyboard',
  aoa: 'USB keyboard',
  disabled: 'Keyboard off',
}

const MICE: Record<MirrorSettings['mouse'], string> = {
  sdk: 'Standard mouse',
  uhid: 'captured mouse',
  aoa: 'USB mouse',
  disabled: 'mouse off',
}

export function pictureSummary(settings: MirrorSettings): string {
  const size = settings.maxSize === 0 ? 'Native' : `${settings.maxSize}px`
  const rate = `${settings.videoBitRate.replace(/M$/, '')} Mbps`
  const codec = CODECS[settings.videoCodec]
  const fps = settings.maxFps > 0 ? ` · ${settings.maxFps} fps` : ''
  return `${size} · ${rate} · ${codec}${fps}`
}

export function soundSummary(settings: MirrorSettings): string {
  if (!settings.audioEnabled) return 'Off'
  if (settings.audioDup) return 'On · Also on the phone'
  return `On · ${AUDIO[settings.audioSource]}`
}

export function windowSummary(settings: MirrorSettings): string {
  const parts: string[] = []
  if (settings.stayAwake) parts.push('Stay awake')
  if (settings.turnScreenOff) parts.push('Screen off')
  if (settings.showTouches) parts.push('Show touches')
  if (settings.alwaysOnTop) parts.push('Always on top')
  if (settings.fullscreen) parts.push('Fullscreen')
  if (settings.borderless) parts.push('Borderless')
  return parts.length > 0 ? parts.join(' · ') : 'Default window'
}

export function inputSummary(settings: MirrorSettings): string {
  if (settings.readOnly) return 'View only'
  return `${KEYS[settings.keyboard]} · ${MICE[settings.mouse]}`
}

export function captureSummary(settings: MirrorSettings): string {
  const parts: string[] = []
  if (settings.videoSource === 'camera') {
    const facing = settings.cameraFacing === 'back' ? 'Back camera' : settings.cameraFacing === 'front' ? 'Front camera' : 'External camera'
    parts.push(facing)
  } else if (settings.virtualDisplay === 'device') {
    parts.push('Virtual display')
  } else if (settings.virtualDisplay === 'custom') {
    parts.push(`Virtual ${settings.virtualWidth}×${settings.virtualHeight}`)
  } else {
    parts.push('Phone screen')
  }
  if (settings.orientation !== 'follow') parts.push('Orientation locked')
  if (settings.recordEnabled) parts.push(settings.recordPath ? 'Recording' : 'Choose a file')
  return parts.join(' · ')
}

export function connectionLabel(device: Device): string {
  if (device.connection === 'wifi') return 'Wi-Fi'
  if (device.connection === 'emulator') return 'Emulator'
  return 'USB'
}

export function statusLabel(device: Device, mirroring: boolean): { text: string; tone: 'success' | 'warning' | 'danger' | 'muted' } {
  if (mirroring) return { text: 'Mirroring', tone: 'success' }
  if (device.state === 'device') return { text: 'Ready', tone: 'success' }
  if (device.state === 'unauthorized') return { text: 'Unlock the phone and tap Allow', tone: 'warning' }
  if (device.state === 'offline') return { text: 'Offline. Unplug the cable and plug it back in.', tone: 'danger' }
  if (device.state === 'no-permissions') return { text: 'USB permission denied. Add your user to plugdev and install the udev rules.', tone: 'danger' }
  if (device.state === 'authorizing' || device.state === 'connecting') return { text: 'Waiting for the phone…', tone: 'warning' }
  return { text: 'Not ready', tone: 'muted' }
}

export function programName(scrcpyPath: string | null): string {
  if (!scrcpyPath) return 'scrcpy'
  const base = scrcpyPath.split(/[\\/]/).pop()
  return base && base.length > 0 ? base : 'scrcpy'
}
