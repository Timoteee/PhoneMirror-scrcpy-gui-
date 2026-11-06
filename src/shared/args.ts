import { isSafeSerial, validateSettings } from './settings'
import type { MirrorSettings, OrientationChoice } from './types'

export interface BuildInput {
  settings: MirrorSettings
  serial?: string
  windowTitle?: string
}

export type BuildResult = { ok: true; args: string[] } | { ok: false; error: string }

function captureOrientation(choice: OrientationChoice): string | null {
  switch (choice) {
    case 'follow':
      return null
    case 'lock':
      return '@'
    case '0':
      return '@0'
    case '90':
      return '@90'
    case '180':
      return '@180'
    case '270':
      return '@270'
    default:
      return null
  }
}

export function windowTitleFor(model: string): string {
  const clean = model
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return clean || 'Phone Mirror'
}

export function tryBuildScrcpyArgs(input: BuildInput): BuildResult {
  const problem = validateSettings(input.settings)
  if (problem) return { ok: false, error: problem }
  if (input.serial !== undefined && !isSafeSerial(input.serial)) {
    return { ok: false, error: 'That phone is not available.' }
  }
  if (input.windowTitle !== undefined && /[\u0000-\u001F]/.test(input.windowTitle)) {
    return { ok: false, error: 'Window title is not valid.' }
  }
  return { ok: true, args: buildArgs(input) }
}

function buildArgs(input: BuildInput): string[] {
  const settings = input.settings
  const args: string[] = []

  if (input.serial) args.push('--serial', input.serial)

  if (settings.videoSource === 'camera') {
    args.push('--video-source', 'camera')
    args.push('--camera-facing', settings.cameraFacing)
  } else if (settings.virtualDisplay === 'device') {
    args.push('--new-display')
  } else if (settings.virtualDisplay === 'custom') {
    args.push(
      '--new-display',
      `${settings.virtualWidth}x${settings.virtualHeight}/${settings.virtualDpi}`,
    )
  }

  if (settings.maxSize > 0) args.push('--max-size', String(settings.maxSize))
  if (settings.videoBitRate !== '8M') args.push('--video-bit-rate', settings.videoBitRate)
  if (settings.maxFps > 0) args.push('--max-fps', String(settings.maxFps))
  if (settings.videoCodec !== 'h264') args.push('--video-codec', settings.videoCodec)

  if (!settings.audioEnabled) {
    args.push('--no-audio')
  } else if (settings.audioDup) {
    args.push('--audio-source', 'playback')
    args.push('--audio-dup')
  } else if (settings.audioSource !== 'output') {
    args.push('--audio-source', settings.audioSource)
  }

  const orientation = captureOrientation(settings.orientation)
  if (orientation) args.push('--capture-orientation', orientation)

  if (settings.stayAwake) args.push('--stay-awake')
  if (settings.turnScreenOff) args.push('--turn-screen-off')
  if (settings.showTouches) args.push('--show-touches')
  if (settings.alwaysOnTop) args.push('--always-on-top')
  if (settings.fullscreen) args.push('--fullscreen')
  if (settings.borderless) args.push('--window-borderless')

  if (settings.readOnly) {
    args.push('--no-control')
  } else {
    if (settings.keyboard !== 'sdk') args.push('--keyboard', settings.keyboard)
    if (settings.mouse !== 'sdk') args.push('--mouse', settings.mouse)
  }

  if (settings.recordEnabled && settings.recordPath) args.push('--record', settings.recordPath)

  if (input.windowTitle) args.push('--window-title', input.windowTitle)

  return args
}

/** Windows command-line quoting for display. Spawn uses the argument array, not this string. */
export function quoteWindowsArg(arg: string): string {
  if (arg.length === 0) return '""'
  if (!/[\t\n\v\f " ]/.test(arg) && !arg.includes(' ')) return arg
  let quoted = '"'
  let backslashes = 0
  for (const ch of arg) {
    if (ch === '\\') {
      backslashes += 1
      continue
    }
    if (ch === '"') {
      quoted += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
      continue
    }
    quoted += '\\'.repeat(backslashes) + ch
    backslashes = 0
  }
  quoted += '\\'.repeat(backslashes * 2) + '"'
  return quoted
}

export function formatCommand(executable: string, args: readonly string[]): string {
  return [executable, ...args].map(quoteWindowsArg).join(' ')
}
