import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function bundledDir(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'scrcpy')
  const folder = process.platform === 'win32' ? 'scrcpy-win64' : 'scrcpy-host'
  return path.join(__dirname, '../../resources', folder)
}

export function scrcpyFileName(): string {
  return process.platform === 'win32' ? 'scrcpy.exe' : 'scrcpy'
}

export function adbFileName(): string {
  return process.platform === 'win32' ? 'adb.exe' : 'adb'
}

export interface ToolPaths {
  scrcpy: string
  adb: string
  custom: boolean
}

export function validateScrcpyBinary(file: string): string | null {
  const base = path.basename(file).toLowerCase()
  if (base !== 'scrcpy' && base !== 'scrcpy.exe') {
    return 'Choose the scrcpy program (scrcpy.exe).'
  }
  if (!fs.existsSync(file)) return 'That file does not exist.'
  const adb = path.join(path.dirname(file), adbFileName())
  if (!fs.existsSync(adb)) {
    return 'adb was not next to that scrcpy. Choose the folder from the official Windows release.'
  }
  return null
}

export function resolveTools(customPath: string | null): ToolPaths | { error: string } {
  if (customPath) {
    const problem = validateScrcpyBinary(customPath)
    if (problem) return { error: problem }
    return {
      scrcpy: customPath,
      adb: path.join(path.dirname(customPath), adbFileName()),
      custom: true,
    }
  }
  const dir = bundledDir()
  const scrcpy = path.join(dir, scrcpyFileName())
  const adb = path.join(dir, adbFileName())
  if (!fs.existsSync(scrcpy) || !fs.existsSync(adb)) {
    return {
      error: 'The bundled scrcpy files are missing. Reinstall Phone Mirror, or choose a scrcpy folder under Advanced.',
    }
  }
  return { scrcpy, adb, custom: false }
}

export function licenseCandidates(scrcpyPath: string | null): string[] {
  const dirs = [scrcpyPath ? path.dirname(scrcpyPath) : bundledDir(), path.join(__dirname, '../../third_party/scrcpy')]
  const names = ['LICENSE', 'LICENSE.txt', 'NOTICE']
  const files: string[] = []
  for (const dir of dirs) {
    for (const name of names) files.push(path.join(dir, name))
  }
  return files
}
