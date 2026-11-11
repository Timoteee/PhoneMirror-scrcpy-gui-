import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseSettings, validateProfileName, validateSettings } from '@shared/settings'
import type { TransferRequest } from '@shared/transfer'
import type { DeviceSnapshot, LogLine, MirrorSettings, SessionInfo } from '@shared/types'
import { connectWifi, disconnectWifi, listDeviceFolder, listDevices, pairWifi, switchUsbToWifi } from './adb'
import { licenseCandidates, resolveTools, toolEnv, validateScrcpyBinary } from './paths'
import { allProfiles, readConfig, readUserProfiles, writeConfig, writeUserProfiles, type PersistedConfig } from './store'
import { SessionManager } from './sessions'
import { runProcess } from './process'
import { TransferManager } from './transfer'

const screenshotDir = app.isPackaged ? undefined : process.env.PHONE_MIRROR_SCREENSHOT_DIR

if (screenshotDir) {
  app.setPath('userData', path.join(os.tmpdir(), 'phone-mirror-screenshots'))
}

const locked = screenshotDir ? true : app.requestSingleInstanceLock()

let mainWindow: BrowserWindow | null = null
let config: PersistedConfig = {
  theme: 'system',
  activeProfileId: 'everyday',
  settings: {
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
  },
  customScrcpyPath: null,
}
let lastSnapshot: DeviceSnapshot = { devices: [], error: null }
let pollTimer: NodeJS.Timeout | null = null
let polling = false

function tools() {
  return resolveTools(config.customScrcpyPath)
}

function send(channel: string, payload: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

const sessions = new SessionManager(
  (line: LogLine) => send('log:line', line),
  (list: SessionInfo[]) => send('session:updated', list),
)

const transfers = new TransferManager(
  (update) => send('transfer:updated', update),
  (line: LogLine) => send('log:line', line),
)

function transferRequestFrom(value: unknown): TransferRequest | { error: string } {
  if (!value || typeof value !== 'object') return { error: 'That transfer is not valid.' }
  const record = value as { serial?: unknown; direction?: unknown; target?: unknown; paths?: unknown }
  if (typeof record.serial !== 'string' || record.serial.length > 128) return { error: 'That phone is not available.' }
  if (record.direction !== 'send' && record.direction !== 'get') return { error: 'That transfer is not supported.' }
  if (typeof record.target !== 'string' || record.target.length > 1024) {
    return { error: record.direction === 'send' ? 'Choose a folder on the phone.' : 'Choose a folder on this PC.' }
  }
  if (!Array.isArray(record.paths) || record.paths.length === 0 || record.paths.length > 500) {
    return { error: 'Choose at least one item to move.' }
  }
  const paths: string[] = []
  for (const item of record.paths) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 1024) {
      return { error: 'One of those items cannot be read. Choose it again.' }
    }
    paths.push(item)
  }
  return { serial: record.serial, direction: record.direction, target: record.target, paths }
}

async function readVersion(scrcpy: string, adb: string): Promise<string | null> {
  const result = await runProcess(scrcpy, ['--version'], { timeoutMs: 8_000, env: toolEnv(adb) })
  const blob = `${result.stdout}\n${result.stderr}`
  const match = /scrcpy\s+([0-9][^\s]*)/i.exec(blob)
  return match?.[1] ?? null
}

async function publishDevices() {
  if (polling) return
  polling = true
  try {
    const resolved = tools()
    if ('error' in resolved) {
      lastSnapshot = { devices: [], error: resolved.error }
    } else {
      lastSnapshot = await listDevices(resolved.adb)
    }
    send('devices:updated', lastSnapshot)
  } finally {
    polling = false
  }
}

function requireTools(): { scrcpy: string; adb: string } | { error: string } {
  const resolved = tools()
  if ('error' in resolved) return resolved
  return { scrcpy: resolved.scrcpy, adb: resolved.adb }
}

function settingsFromPayload(value: unknown): MirrorSettings | { error: string } {
  const settings = parseSettings(value)
  if (!settings) return { error: 'Those settings are not valid.' }
  const problem = validateSettings(settings)
  if (problem) return { error: problem }
  return settings
}

function createWindow() {
  const dark =
    config.theme === 'dark' || (config.theme === 'system' && nativeTheme.shouldUseDarkColors)
  mainWindow = new BrowserWindow({
    width: screenshotDir ? 1280 : 1120,
    height: screenshotDir ? 880 : 780,
    minWidth: 880,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Phone Mirror',
    backgroundColor: dark ? '#1F1F1F' : '#F3F3F3',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow.removeMenu()
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.ELECTRON_RENDERER_URL
    if (allowed && url.startsWith(allowed)) return
    if (url.startsWith(pathToFileURL(path.join(__dirname, '../renderer/')).href)) return
    event.preventDefault()
  })

  if (app.isPackaged) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:",
          ],
        },
      })
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', async () => {
    const resolved = tools()
    const scrcpyPath = 'error' in resolved ? null : resolved.scrcpy
    const version = scrcpyPath && !('error' in resolved) ? await readVersion(resolved.scrcpy, resolved.adb) : null
    return {
      scrcpyPath,
      scrcpyVersion: version,
      scrcpyCustom: !('error' in resolved) && resolved.custom,
      scrcpyError: 'error' in resolved ? resolved.error : null,
      theme: config.theme,
      systemDark: nativeTheme.shouldUseDarkColors,
      activeProfileId: config.activeProfileId,
      settings: config.settings,
      profiles: allProfiles(),
      screenshot: Boolean(screenshotDir),
    }
  })

  ipcMain.handle('devices:refresh', async () => {
    await publishDevices()
    return lastSnapshot
  })

  ipcMain.handle('mirror:start', async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Those settings are not valid.' }
    const record = payload as { serial?: unknown; settings?: unknown }
    if (typeof record.serial !== 'string') return { ok: false, error: 'Select a phone first.' }
    const settings = settingsFromPayload(record.settings)
    if ('error' in settings) return settings
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    config.settings = settings
    writeConfig(config)
    return sessions.start(resolved.scrcpy, resolved.adb, record.serial, settings, lastSnapshot.devices)
  })

  ipcMain.handle('mirror:stop', async (_event, serial: unknown) => {
    if (typeof serial !== 'string') return { ok: false, error: 'That phone is not available.' }
    return sessions.stop(serial)
  })

  ipcMain.handle('mirror:startAll', async (_event, settingsValue: unknown) => {
    const settings = settingsFromPayload(settingsValue)
    if ('error' in settings) return settings
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    const ready = lastSnapshot.devices.filter((device) => device.state === 'device')
    if (ready.length < 2) return { ok: false, error: 'Connect at least two ready phones to mirror them all.' }
    config.settings = settings
    writeConfig(config)
    const errors: string[] = []
    for (const device of ready) {
      const result = sessions.start(resolved.scrcpy, resolved.adb, device.serial, settings, lastSnapshot.devices)
      if (!result.ok) errors.push(result.error)
    }
    if (errors.length === ready.length) return { ok: false, error: errors[0] ?? 'Could not start mirroring.' }
    return { ok: true, message: `Started ${ready.length - errors.length} phones.` }
  })

  ipcMain.handle('dialog:record', async (_event, suggested: unknown) => {
    const name = typeof suggested === 'string' && /^[\w.-]{1,80}$/.test(suggested) ? suggested : 'PhoneMirror.mp4'
    const options = {
      title: 'Record mirroring to',
      defaultPath: name,
      filters: [
        { name: 'Video', extensions: ['mp4', 'mkv'] },
        { name: 'All files', extensions: ['*'] },
      ],
    }
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('wifi:connect', async (_event, payload: unknown) => {
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Enter an IP address and port.' }
    const record = payload as { host?: unknown; port?: unknown }
    if (typeof record.host !== 'string' || typeof record.port !== 'string') {
      return { ok: false, error: 'Enter an IP address and port.' }
    }
    const result = await connectWifi(resolved.adb, record.host, record.port)
    await publishDevices()
    return result
  })

  ipcMain.handle('wifi:pair', async (_event, payload: unknown) => {
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Enter the pairing details from the phone.' }
    const record = payload as { host?: unknown; pairPort?: unknown; code?: unknown; connectPort?: unknown }
    if (
      typeof record.host !== 'string' ||
      typeof record.pairPort !== 'string' ||
      typeof record.code !== 'string' ||
      typeof record.connectPort !== 'string'
    ) {
      return { ok: false, error: 'Enter the pairing details from the phone.' }
    }
    const result = await pairWifi(resolved.adb, record.host, record.pairPort, record.code, record.connectPort)
    await publishDevices()
    return result
  })

  ipcMain.handle('wifi:tcpip', async (_event, payload: unknown) => {
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Select a USB phone first.' }
    const record = payload as { serial?: unknown; port?: unknown }
    if (typeof record.serial !== 'string' || typeof record.port !== 'string') {
      return { ok: false, error: 'Select a USB phone first.' }
    }
    const result = await switchUsbToWifi(resolved.adb, record.serial, record.port, lastSnapshot.devices)
    await publishDevices()
    return result
  })

  ipcMain.handle('wifi:disconnect', async (_event, serial: unknown) => {
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    if (typeof serial !== 'string') return { ok: false, error: 'That phone is not available.' }
    const result = await disconnectWifi(resolved.adb, serial, lastSnapshot.devices)
    await publishDevices()
    return result
  })

  ipcMain.handle('files:list', async (_event, payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return { path: '', entries: [], error: 'Choose a folder on the phone.' }
    }
    const record = payload as { serial?: unknown; path?: unknown }
    if (typeof record.serial !== 'string' || typeof record.path !== 'string') {
      return { path: '', entries: [], error: 'Choose a folder on the phone.' }
    }
    const resolved = requireTools()
    if ('error' in resolved) return { path: record.path, entries: [], error: resolved.error }
    return listDeviceFolder(resolved.adb, record.serial, record.path)
  })

  ipcMain.handle('files:pick', async (_event, kind: unknown) => {
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> =
      kind === 'files' ? ['openFile', 'multiSelections'] : ['openDirectory']
    const title =
      kind === 'files'
        ? 'Choose files to send'
        : kind === 'folder'
          ? 'Choose a folder to send'
          : 'Choose a folder on this PC'
    const options = { title, properties, ...(kind === 'destination' ? { buttonLabel: 'Use this folder' } : {}) }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return kind === 'files' ? [] : null
    return kind === 'files' ? result.filePaths : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('transfer:start', async (_event, payload: unknown) => {
    const resolved = requireTools()
    if ('error' in resolved) return { ok: false, error: resolved.error }
    const request = transferRequestFrom(payload)
    if ('error' in request) return request
    const device = lastSnapshot.devices.find((item) => item.serial === request.serial)
    if (!device || device.state !== 'device') {
      return { ok: false, error: 'That phone is not ready. Unlock it and try again.' }
    }
    return transfers.start(resolved.adb, request, device.model)
  })

  ipcMain.handle('transfer:cancel', async (_event, id: unknown) => {
    if (typeof id !== 'string') return { ok: false, error: 'That transfer has already finished.' }
    return transfers.cancel(id)
  })

  ipcMain.handle('config:save', async (_event, patch: unknown) => {
    if (!patch || typeof patch !== 'object') return
    const record = patch as { theme?: unknown; activeProfileId?: unknown; settings?: unknown }
    if (record.theme === 'system' || record.theme === 'light' || record.theme === 'dark') config.theme = record.theme
    if (typeof record.activeProfileId === 'string' && record.activeProfileId.length <= 80) {
      config.activeProfileId = record.activeProfileId
    }
    if (record.settings !== undefined) {
      const settings = parseSettings(record.settings)
      if (settings && !validateSettings(settings)) config.settings = settings
    }
    writeConfig(config)
  })

  ipcMain.handle('profiles:save', async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') return { error: 'Could not save that preset.' }
    const record = input as { id?: unknown; name?: unknown; settings?: unknown }
    if (typeof record.name !== 'string') return { error: 'Name the preset first.' }
    const named = validateProfileName(record.name)
    if ('error' in named) return named
    const settings = settingsFromPayload(record.settings)
    if ('error' in settings) return settings
    const users = readUserProfiles()
    if (typeof record.id === 'string') {
      const existing = users.find((profile) => profile.id === record.id)
      if (!existing) return { error: 'That preset cannot be changed.' }
      existing.name = named.name
      existing.settings = settings
      writeUserProfiles(users)
      return allProfiles()
    }
    const id = `user-${Date.now().toString(36)}`
    users.push({ id, name: named.name, builtIn: false, settings })
    writeUserProfiles(users)
    config.activeProfileId = id
    config.settings = settings
    writeConfig(config)
    return allProfiles()
  })

  ipcMain.handle('profiles:delete', async (_event, id: unknown) => {
    if (typeof id !== 'string' || !id.startsWith('user-')) return allProfiles()
    writeUserProfiles(readUserProfiles().filter((profile) => profile.id !== id))
    if (config.activeProfileId === id) config.activeProfileId = 'everyday'
    writeConfig(config)
    return allProfiles()
  })

  ipcMain.handle('scrcpy:pick', async () => {
    const options = {
      title: 'Choose scrcpy',
      properties: ['openFile'] as ['openFile'],
      filters:
        process.platform === 'win32'
          ? [{ name: 'scrcpy', extensions: ['exe'] }]
          : [{ name: 'scrcpy', extensions: ['*'] }],
    }
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return { path: null }
    const file = result.filePaths[0]
    const problem = validateScrcpyBinary(file)
    if (problem) return { path: null, error: problem }
    config.customScrcpyPath = file
    writeConfig(config)
    const resolved = tools()
    const version = 'error' in resolved ? null : await readVersion(resolved.scrcpy, resolved.adb)
    await publishDevices()
    return { path: file, version, error: null }
  })

  ipcMain.handle('scrcpy:reset', async () => {
    config.customScrcpyPath = null
    writeConfig(config)
    const resolved = tools()
    await publishDevices()
    if ('error' in resolved) return { path: null, version: null, error: resolved.error }
    const version = await readVersion(resolved.scrcpy, resolved.adb)
    return { path: resolved.scrcpy, version, error: null }
  })

  ipcMain.handle('app:license', async () => {
    const resolved = tools()
    const scrcpy = 'error' in resolved ? null : resolved.scrcpy
    for (const file of licenseCandidates(scrcpy)) {
      try {
        const text = fs.readFileSync(file, 'utf8')
        if (text.trim()) return text.slice(0, 40_000)
      } catch {
        continue
      }
    }
    return 'The Apache License 2.0 file was not found next to scrcpy. scrcpy is copyright Genymobile and Romain Vimont and is licensed under the Apache License, Version 2.0.'
  })

  ipcMain.handle('clipboard:write', async (_event, text: unknown) => {
    if (typeof text !== 'string') return
    if (text.length > 8000 || text.includes('\u0000')) return
    clipboard.writeText(text)
  })

  if (screenshotDir) {
    ipcMain.handle('shot:capture', async (_event, name: unknown) => {
      if (typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name) || !mainWindow) return
      const image = await mainWindow.capturePage()
      fs.mkdirSync(screenshotDir, { recursive: true })
      fs.writeFileSync(path.join(screenshotDir, `${name}.png`), image.toPNG())
    })
    ipcMain.handle('shot:finish', async () => {
      app.quit()
    })
  }
}

if (!locked) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    config = readConfig()
    registerIpc()
    createWindow()
    void publishDevices()
    pollTimer = setInterval(() => {
      void publishDevices()
    }, 2000)
    nativeTheme.on('updated', () => {
      send('theme:system', nativeTheme.shouldUseDarkColors)
    })
  })

  app.on('before-quit', () => {
    if (pollTimer) clearInterval(pollTimer)
    sessions.stopAll()
    transfers.dispose()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
