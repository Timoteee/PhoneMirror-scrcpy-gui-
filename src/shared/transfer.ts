/**
 * Pure helpers for moving files between this PC and the phone over adb.
 *
 * Two different validation rules apply and must not be mixed:
 * - `isSafeDevicePath` guards values handed to adb as a *real argument*
 *   (`adb push`, `adb pull`, `adb install`). adb does not run them through a shell.
 * - `shellQuoteDevicePath` guards values that end up inside `adb shell …`, where
 *   adb joins its arguments and the phone's shell parses the result.
 */

export interface DeviceEntry {
  name: string
  path: string
  size: number
  dir: boolean
  /** Symlinks are listed but never pulled: a link to a directory would copy the whole store. */
  link?: boolean
}

export type TransferDirection = 'send' | 'get'
export type TransferState = 'running' | 'done' | 'failed' | 'cancelled'

export interface TransferRequest {
  serial: string
  direction: TransferDirection
  /** Send: the device folder. Get: the PC folder. */
  target: string
  /** Send: absolute PC paths. Get: absolute device paths. */
  paths: string[]
}

export interface TransferUpdate {
  id: string
  serial: string
  direction: TransferDirection
  state: TransferState
  index: number
  total: number
  label: string
  percent: number | null
  message?: string
}

export interface FolderListing {
  path: string
  entries: DeviceEntry[]
  error: string | null
}

export type StartTransferResult = { ok: true; id: string } | { ok: false; error: string }

const MAX_PATH = 1024
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/

/** A device path is safe when it is absolute, bounded, free of control characters and of `..`. */
export function isSafeDevicePath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > MAX_PATH) return false
  if (!value.startsWith('/')) return false
  if (CONTROL_CHARS.test(value)) return false
  return !value.split('/').includes('..')
}

/**
 * Quote a device path for `adb shell`. Returns null rather than guessing when the path
 * cannot be represented safely. Single-quote escaping is `'\''`, which Android's sh handles.
 */
export function shellQuoteDevicePath(value: string): string | null {
  if (!isSafeDevicePath(value)) return null
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** Join one listing name onto a device folder, collapsing trailing slashes. */
export function joinDevicePath(parent: string, name: string): string {
  if (!parent.startsWith('/')) return `/${name}`
  const base = parent.replace(/\/+$/, '')
  return base === '' ? `/${name}` : `${base}/${name}`
}

/** The folder above a device path. `/` is its own parent. */
export function parentDevicePath(value: string): string {
  const trimmed = value.replace(/\/+$/, '')
  if (!value.startsWith('/') || trimmed === '') return '/'
  const index = trimmed.lastIndexOf('/')
  return index <= 0 ? '/' : trimmed.slice(0, index)
}

/** Last path segment of a device path. */
export function deviceBasename(value: string): string {
  const trimmed = value.replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  return index < 0 ? trimmed : trimmed.slice(index + 1)
}

function pcSeparator(folder: string): string {
  return folder.includes('\\') && !folder.includes('/') ? '\\' : '/'
}

/** Where a sent folder lands on the phone: always `<target>/<local folder name>`. */
export function pushDestination(target: string, localPath: string): string {
  const trimmed = localPath.replace(/[\\/]+$/, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  const name = index < 0 ? trimmed : trimmed.slice(index + 1)
  return joinDevicePath(target, name)
}

/** Where a pulled file lands on this PC. */
export function pullDestination(pcFolder: string, devicePath: string): string {
  const base = pcFolder.replace(/[\\/]+$/, '')
  return `${base}${pcSeparator(pcFolder)}${deviceBasename(devicePath)}`
}

/**
 * A free file name next to an existing one: `photo.jpg` becomes `photo (1).jpg`.
 * `exists` is supplied by the caller so this stays testable without a file system.
 */
export function nextFreeName(name: string, exists: (candidate: string) => boolean): string {
  if (!exists(name)) return name
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  for (let n = 1; n < 1000; n += 1) {
    const candidate = `${stem} (${n})${extension}`
    if (!exists(candidate)) return candidate
  }
  return `${stem} (${Date.now()})${extension}`
}

/** Folders first, then files, each alphabetical by name. */
export function sortDeviceEntries(entries: DeviceEntry[]): DeviceEntry[] {
  return [...entries].sort((a, b) => {
    if (a.dir !== b.dir) return a.dir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/** The last integer percent in a chunk of adb output, clamped to 0–100. Installs have none. */
export function parseTransferPercent(chunk: string): number | null {
  let result: number | null = null
  for (const match of chunk.matchAll(/(\d{1,3})\s*%/g)) {
    result = Number(match[1])
  }
  if (result === null || !Number.isFinite(result)) return null
  return Math.max(0, Math.min(100, result))
}

/**
 * Percent for progress we measure ourselves, because adb prints no percentage lines when its
 * output is a pipe. Floored to a whole number and capped at 99 so only completion shows 100.
 */
export function measuredPercent(done: number, total: number): number | null {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null
  if (done <= 0) return 0
  return Math.min(99, Math.floor((done / total) * 100))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1000) return `${Math.round(bytes)} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const MODE_LINE = /^([-dlbcps])[rwxsStT-]{9}[.+@]?\s+(.+)$/
const MONTH = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/

function dateColumns(tokens: string[]): { at: number; width: number } | null {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(token) && /^\d{2}:\d{2}(?::\d{2})?$/.test(tokens[index + 1] ?? '')) {
      return { at: index, width: 2 }
    }
    if (
      MONTH.test(token) &&
      /^\d{1,2}$/.test(tokens[index + 1] ?? '') &&
      /^(?:\d{1,2}:\d{2}|\d{4})$/.test(tokens[index + 2] ?? '')
    ) {
      return { at: index, width: 3 }
    }
  }
  return null
}

/**
 * Parse `adb shell ls -la <dir>` output for one folder. Skips the `total` line, `.` and `..`,
 * and any line that does not carry a recognisable date column rather than inventing a name.
 */
export function parseDeviceListing(stdout: string, folder: string): DeviceEntry[] {
  const entries: DeviceEntry[] = []
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (!line || line.startsWith('total ')) continue
    const mode = MODE_LINE.exec(line)
    if (!mode) continue
    const kind = mode[1]
    if (kind !== '-' && kind !== 'd' && kind !== 'l') continue
    const tokens = (mode[2] ?? '').split(/\s+/)
    const when = dateColumns(tokens)
    if (!when) continue
    let size = 0
    for (let index = when.at - 1; index >= 0; index -= 1) {
      const token = tokens[index] ?? ''
      if (/^\d+$/.test(token)) {
        size = Number(token)
        break
      }
    }
    const tail = tokens.slice(when.at + when.width).join(' ')
    const name = (kind === 'l' ? tail.split(' -> ')[0] : tail) ?? ''
    if (!name || name === '.' || name === '..') continue
    entries.push({
      name,
      path: joinDevicePath(folder, name),
      size,
      dir: kind === 'd',
      ...(kind === 'l' ? { link: true } : {}),
    })
  }
  return entries
}
