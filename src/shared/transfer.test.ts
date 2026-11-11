import { describe, expect, it } from 'vitest'
import {
  deviceBasename,
  formatBytes,
  isSafeDevicePath,
  joinDevicePath,
  measuredPercent,
  nextFreeName,
  parentDevicePath,
  parseDeviceListing,
  parseTransferPercent,
  pullDestination,
  pushDestination,
  shellQuoteDevicePath,
  sortDeviceEntries,
} from './transfer'

const TOYBOX_LISTING = [
  'total 24',
  'drwxrwx--x 2 root sdcard_rw 4096 2026-11-11 12:34 DCIM',
  '-rw-rw---- 1 u0_a123 sdcard_rw 1234567 2026-11-11 12:34 My video.mp4',
  'lrwxrwxrwx 1 root root 21 2026-11-11 12:30 sdcard -> /storage/self/primary',
  'drwxrwx--x 2 root sdcard_rw 4096 2026-11-11 12:34 ..',
  'drwxrwx--x 2 root sdcard_rw 4096 2026-11-11 12:34 .',
  'ls: /sdcard/Android/data: Permission denied',
  '',
].join('\r\n')

describe('isSafeDevicePath', () => {
  it('accepts absolute device paths, including spaces', () => {
    expect(isSafeDevicePath('/sdcard/Download')).toBe(true)
    expect(isSafeDevicePath('/sdcard/My Folder/IMG 0001.jpg')).toBe(true)
    expect(isSafeDevicePath('/')).toBe(true)
  })

  it('rejects relative paths, traversal and control characters', () => {
    expect(isSafeDevicePath('sdcard/Download')).toBe(false)
    expect(isSafeDevicePath('')).toBe(false)
    expect(isSafeDevicePath('/sdcard/../data')).toBe(false)
    expect(isSafeDevicePath('/sdcard/Download\nrm -rf /')).toBe(false)
    expect(isSafeDevicePath('/sdcard/Download\u0000')).toBe(false)
    expect(isSafeDevicePath(`/${'a'.repeat(1024)}`)).toBe(false)
    expect(isSafeDevicePath(42)).toBe(false)
  })
})

describe('shellQuoteDevicePath', () => {
  it('wraps a plain path in single quotes', () => {
    expect(shellQuoteDevicePath('/sdcard/Download')).toBe("'/sdcard/Download'")
    expect(shellQuoteDevicePath('/sdcard/My Folder')).toBe("'/sdcard/My Folder'")
  })

  it('escapes an apostrophe instead of dropping the folder', () => {
    expect(shellQuoteDevicePath("/sdcard/Bob's pics")).toBe("'/sdcard/Bob'\\''s pics'")
  })

  it('refuses paths it cannot quote safely', () => {
    expect(shellQuoteDevicePath('/sdcard/bad\nname')).toBeNull()
    expect(shellQuoteDevicePath('relative')).toBeNull()
  })
})

describe('parseDeviceListing', () => {
  it('parses toybox ls -la output for one folder', () => {
    const entries = parseDeviceListing(TOYBOX_LISTING, '/sdcard/Download')
    expect(entries.map((entry) => entry.name)).toEqual(['DCIM', 'My video.mp4', 'sdcard'])
  })

  it('reports folders, files, sizes and full paths', () => {
    const [folder, file, link] = parseDeviceListing(TOYBOX_LISTING, '/sdcard/Download')
    expect(folder).toMatchObject({ name: 'DCIM', dir: true, path: '/sdcard/Download/DCIM', size: 4096 })
    expect(file).toMatchObject({ name: 'My video.mp4', dir: false, path: '/sdcard/Download/My video.mp4', size: 1234567 })
    expect(link).toMatchObject({ name: 'sdcard', dir: false, link: true, path: '/sdcard/Download/sdcard' })
  })

  it('skips totals, dot entries, permission errors and blank lines', () => {
    const names = parseDeviceListing(TOYBOX_LISTING, '/sdcard').map((entry) => entry.name)
    expect(names).not.toContain('.')
    expect(names).not.toContain('..')
    expect(names.some((name) => name.includes('Permission denied'))).toBe(false)
  })

  it('handles the older month-date column', () => {
    const legacy = '-rw-r--r-- 1 root root 1234 Jan  4 09:12 photo.jpg'
    expect(parseDeviceListing(legacy, '/sdcard/DCIM')).toEqual([
      { name: 'photo.jpg', path: '/sdcard/DCIM/photo.jpg', size: 1234, dir: false },
    ])
  })

  it('ignores device nodes that are neither files, folders nor links', () => {
    const block = 'brw-rw---- 1 root root 8192 2026-11-11 12:34 sda'
    expect(parseDeviceListing(block, '/dev')).toEqual([])
  })
})

describe('device path helpers', () => {
  it('joins names onto a folder', () => {
    expect(joinDevicePath('/sdcard/Download', 'x.mp4')).toBe('/sdcard/Download/x.mp4')
    expect(joinDevicePath('/sdcard/Download/', 'x.mp4')).toBe('/sdcard/Download/x.mp4')
    expect(joinDevicePath('/', 'sdcard')).toBe('/sdcard')
  })

  it('walks up without escaping the root', () => {
    expect(parentDevicePath('/sdcard/Download')).toBe('/sdcard')
    expect(parentDevicePath('/sdcard')).toBe('/')
    expect(parentDevicePath('/sdcard/')).toBe('/')
    expect(parentDevicePath('/')).toBe('/')
  })

  it('takes the last segment', () => {
    expect(deviceBasename('/sdcard/DCIM/Camera/IMG_1.jpg')).toBe('IMG_1.jpg')
    expect(deviceBasename('/sdcard/DCIM/')).toBe('DCIM')
  })
})

describe('sortDeviceEntries', () => {
  it('puts folders first, then files in natural name order', () => {
    const sorted = sortDeviceEntries([
      { name: 'IMG_10.jpg', path: '/x/IMG_10.jpg', size: 1, dir: false },
      { name: 'zed', path: '/x/zed', size: 0, dir: true },
      { name: 'IMG_2.jpg', path: '/x/IMG_2.jpg', size: 1, dir: false },
      { name: 'Alpha', path: '/x/Alpha', size: 0, dir: true },
    ])
    expect(sorted.map((entry) => entry.name)).toEqual(['Alpha', 'zed', 'IMG_2.jpg', 'IMG_10.jpg'])
  })
})

describe('transfer destinations', () => {
  it('sends a folder to <target>/<folder name>', () => {
    expect(pushDestination('/sdcard/Download', 'C:\\Users\\me\\Holiday')).toBe('/sdcard/Download/Holiday')
    expect(pushDestination('/sdcard/Download', '/home/me/Trips')).toBe('/sdcard/Download/Trips')
    expect(pushDestination('/', 'C:/Users/me/Holiday')).toBe('/Holiday')
  })

  it('pulls a file into the chosen PC folder with that folder separated', () => {
    expect(pullDestination('C:\\Users\\me\\Pictures', '/sdcard/DCIM/Camera/IMG_1.jpg')).toBe(
      'C:\\Users\\me\\Pictures\\IMG_1.jpg',
    )
    expect(pullDestination('/home/me/Pictures', '/sdcard/DCIM/IMG_1.jpg')).toBe('/home/me/Pictures/IMG_1.jpg')
    expect(pullDestination('D:\\', '/sdcard/a.mp4')).toBe('D:\\a.mp4')
  })

  it('never overwrites an existing PC file silently', () => {
    const taken = new Set(['photo.jpg', 'photo (1).jpg'])
    expect(nextFreeName('photo.jpg', (name) => taken.has(name))).toBe('photo (2).jpg')
    expect(nextFreeName('photo.jpg', () => false)).toBe('photo.jpg')
    expect(nextFreeName('VID_0001', (name) => name === 'VID_0001')).toBe('VID_0001 (1)')
  })
})

describe('parseTransferPercent', () => {
  it('reads adb progress lines', () => {
    expect(parseTransferPercent('[ 42%] /sdcard/Download/x.mp4')).toBe(42)
    expect(parseTransferPercent('Holiday/IMG_1.jpg\r\n  7% Holiday/IMG_1.jpg')).toBe(7)
    expect(parseTransferPercent('[100%] /sdcard/x.mp4')).toBe(100)
  })

  it('takes the last percentage in a chunk and clamps it', () => {
    expect(parseTransferPercent('[ 10%] a\r\n[ 11%] a')).toBe(11)
    expect(parseTransferPercent('[120%] a')).toBe(100)
  })

  it('returns null when there is no percentage, such as an install', () => {
    expect(parseTransferPercent('Performing Streamed Install')).toBeNull()
    expect(parseTransferPercent('Success')).toBeNull()
    expect(parseTransferPercent('')).toBeNull()
  })
})

describe('measuredPercent', () => {
  it('floors a byte ratio and never claims 100 before the job ends', () => {
    expect(measuredPercent(0, 1000)).toBe(0)
    expect(measuredPercent(417, 1000)).toBe(41)
    expect(measuredPercent(999, 1000)).toBe(99)
    expect(measuredPercent(1000, 1000)).toBe(99)
    expect(measuredPercent(2000, 1000)).toBe(99)
  })

  it('returns null when the total is unknown', () => {
    expect(measuredPercent(10, 0)).toBeNull()
    expect(measuredPercent(Number.NaN, 100)).toBeNull()
  })
})

describe('formatBytes', () => {
  it('formats sizes for the listing', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1000)).toBe('1.0 kB')
    expect(formatBytes(1234567)).toBe('1.2 MB')
    expect(formatBytes(15_000_000)).toBe('15 MB')
    expect(formatBytes(-1)).toBe('—')
  })
})
