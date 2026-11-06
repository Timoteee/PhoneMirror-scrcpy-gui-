import { describe, expect, it } from 'vitest'
import { formatCommand, quoteWindowsArg, tryBuildScrcpyArgs, windowTitleFor } from './args'
import {
  DEFAULT_SETTINGS,
  isIpv4,
  parseSettings,
  presetHighQuality,
  presetLowLatency,
  presetRecording,
  validateHostPort,
  validatePairingCode,
  validateSettings,
} from './settings'
import type { MirrorSettings } from './types'

function build(settings: MirrorSettings, serial = 'R5CW123ABC', title = 'Pixel 8') {
  return tryBuildScrcpyArgs({ settings, serial, windowTitle: title })
}

describe('tryBuildScrcpyArgs', () => {
  it('keeps everyday defaults short and includes stay-awake', () => {
    const result = build(DEFAULT_SETTINGS)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toEqual(['--serial', 'R5CW123ABC', '--stay-awake', '--window-title', 'Pixel 8'])
  })

  it('builds the low-latency preset', () => {
    const result = build(presetLowLatency())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toEqual([
      '--serial',
      'R5CW123ABC',
      '--max-size',
      '1024',
      '--video-bit-rate',
      '4M',
      '--max-fps',
      '60',
      '--no-audio',
      '--stay-awake',
      '--window-title',
      'Pixel 8',
    ])
  })

  it('builds the high-quality preset with H.265', () => {
    const result = build(presetHighQuality())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('--video-codec')
    expect(result.args).toContain('h265')
    expect(result.args).toContain('--video-bit-rate')
    expect(result.args).toContain('16M')
    expect(result.args).toContain('--max-fps')
    expect(result.args).not.toContain('--no-audio')
  })

  it('passes a recording path as one argument, including spaces', () => {
    const settings = presetRecording()
    settings.recordPath = 'C:\\Users\\Ada\\Phone recordings\\demo.mp4'
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('--record')
    const recordIndex = result.args.indexOf('--record')
    expect(result.args[recordIndex + 1]).toBe('C:\\Users\\Ada\\Phone recordings\\demo.mp4')
    expect(result.args.some((arg) => arg.includes('&&') || arg.includes(';'))).toBe(false)
  })

  it('mirrors a camera and ignores a virtual display at the same time', () => {
    const settings: MirrorSettings = {
      ...DEFAULT_SETTINGS,
      videoSource: 'camera',
      cameraFacing: 'front',
      virtualDisplay: 'custom',
      virtualWidth: 1920,
      virtualHeight: 1080,
      virtualDpi: 420,
    }
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toEqual(expect.arrayContaining(['--video-source', 'camera', '--camera-facing', 'front']))
    expect(result.args).not.toContain('--new-display')
  })

  it('builds a custom virtual display', () => {
    const settings: MirrorSettings = {
      ...DEFAULT_SETTINGS,
      virtualDisplay: 'custom',
      virtualWidth: 1920,
      virtualHeight: 1080,
      virtualDpi: 240,
    }
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('--new-display')
    expect(result.args).toContain('1920x1080/240')
  })

  it('locks capture orientation', () => {
    const settings: MirrorSettings = { ...DEFAULT_SETTINGS, orientation: '90' }
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('--capture-orientation')
    expect(result.args).toContain('@90')
  })

  it('locks to the current orientation with @', () => {
    const settings: MirrorSettings = { ...DEFAULT_SETTINGS, orientation: 'lock' }
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('@')
  })

  it('omits keyboard and mouse flags when read-only', () => {
    const settings: MirrorSettings = {
      ...DEFAULT_SETTINGS,
      readOnly: true,
      keyboard: 'uhid',
      mouse: 'aoa',
    }
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('--no-control')
    expect(result.args).not.toContain('--keyboard')
    expect(result.args).not.toContain('--mouse')
  })

  it('forces playback capture when audio stays on the phone', () => {
    const settings: MirrorSettings = {
      ...DEFAULT_SETTINGS,
      audioEnabled: true,
      audioSource: 'mic',
      audioDup: true,
    }
    const result = build(settings)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args).toContain('--audio-source')
    expect(result.args).toContain('playback')
    expect(result.args).toContain('--audio-dup')
    expect(result.args).not.toContain('mic')
  })

  it('rejects shell metacharacters in bitrate before any args are produced', () => {
    const settings = { ...DEFAULT_SETTINGS, videoBitRate: '8M && calc.exe' }
    expect(parseSettings(settings)).toBeNull()
    expect(validateSettings({ ...DEFAULT_SETTINGS, videoBitRate: '8M;whoami' })).toBeTruthy()
    const result = tryBuildScrcpyArgs({ settings: { ...DEFAULT_SETTINGS, videoBitRate: '8M;whoami' } })
    expect(result.ok).toBe(false)
  })

  it('rejects a recording path that is not absolute', () => {
    const settings: MirrorSettings = {
      ...DEFAULT_SETTINGS,
      recordEnabled: true,
      recordPath: 'demo.mp4 && scrcpy',
    }
    const result = tryBuildScrcpyArgs({ settings })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/file/i)
  })

  it('rejects an unsafe serial', () => {
    const result = tryBuildScrcpyArgs({
      settings: DEFAULT_SETTINGS,
      serial: 'abc;calc',
    })
    expect(result.ok).toBe(false)
  })
})

describe('formatCommand', () => {
  it('quotes paths with spaces and leaves flags bare', () => {
    const line = formatCommand('C:\\Program Files\\Phone Mirror\\scrcpy.exe', [
      '--serial',
      'ABC',
      '--record',
      'C:\\Users\\Ada\\My Videos\\clip.mp4',
    ])
    expect(line).toBe(
      '"C:\\Program Files\\Phone Mirror\\scrcpy.exe" --serial ABC --record "C:\\Users\\Ada\\My Videos\\clip.mp4"',
    )
  })

  it('escapes quotes inside an argument', () => {
    expect(quoteWindowsArg('say "hi"')).toBe('"say \\"hi\\""')
  })

  it('quotes an empty argument', () => {
    expect(quoteWindowsArg('')).toBe('""')
  })
})

describe('windowTitleFor', () => {
  it('drops control characters and falls back when empty', () => {
    expect(windowTitleFor('Pixel\n8')).toBe('Pixel 8')
    expect(windowTitleFor(' \n ')).toBe('Phone Mirror')
  })
})

describe('network input', () => {
  it('accepts a normal IPv4 address and port', () => {
    expect(validateHostPort('192.168.1.20', '5555')).toEqual({ host: '192.168.1.20', port: 5555 })
  })

  it('rejects shell-looking hosts and out-of-range ports', () => {
    expect(isIpv4('192.168.1.1;calc')).toBe(false)
    expect(validateHostPort('192.168.1.1 && whoami', '5555')).toEqual({
      error: 'Enter an IP address, such as 192.168.1.20.',
    })
    expect(validateHostPort('192.168.1.20', '99999')).toMatchObject({ error: expect.stringMatching(/Port/) })
    expect(validateHostPort('192.168.1.20', '0')).toMatchObject({ error: expect.stringMatching(/Port/) })
    expect(validateHostPort('10.0.0.01', '5555')).toMatchObject({ error: expect.stringMatching(/IP/) })
  })

  it('requires a 6-digit pairing code', () => {
    expect(validatePairingCode('123 456')).toEqual({ code: '123456' })
    expect(validatePairingCode('12345')).toMatchObject({ error: expect.stringMatching(/6-digit/) })
    expect(validatePairingCode('123456;')).toMatchObject({ error: expect.stringMatching(/6-digit/) })
  })
})
