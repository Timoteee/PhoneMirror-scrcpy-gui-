import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { PhoneMirrorApi } from '@shared/api'
import type { TransferUpdate } from '@shared/transfer'
import type { DeviceSnapshot, LogLine, SessionInfo } from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void) {
  const listener = (_event: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: PhoneMirrorApi = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  refreshDevices: () => ipcRenderer.invoke('devices:refresh'),
  onDevices: (cb) => subscribe<DeviceSnapshot>('devices:updated', cb),
  onLog: (cb) => subscribe<LogLine>('log:line', cb),
  onSession: (cb) => subscribe<SessionInfo[]>('session:updated', cb),
  onSystemTheme: (cb) => subscribe<boolean>('theme:system', cb),
  startMirror: (payload) => ipcRenderer.invoke('mirror:start', payload),
  stopMirror: (serial) => ipcRenderer.invoke('mirror:stop', serial),
  startAll: (settings) => ipcRenderer.invoke('mirror:startAll', settings),
  pickRecord: (suggestedName) => ipcRenderer.invoke('dialog:record', suggestedName),
  wifiConnect: (payload) => ipcRenderer.invoke('wifi:connect', payload),
  wifiPair: (payload) => ipcRenderer.invoke('wifi:pair', payload),
  wifiTcpip: (payload) => ipcRenderer.invoke('wifi:tcpip', payload),
  wifiDisconnect: (serial) => ipcRenderer.invoke('wifi:disconnect', serial),
  saveConfig: (patch) => ipcRenderer.invoke('config:save', patch),
  saveProfile: (input) => ipcRenderer.invoke('profiles:save', input),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  pickScrcpy: () => ipcRenderer.invoke('scrcpy:pick'),
  resetScrcpy: () => ipcRenderer.invoke('scrcpy:reset'),
  readLicense: () => ipcRenderer.invoke('app:license'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  listDeviceFolder: (query) => ipcRenderer.invoke('files:list', query),
  pickFiles: () => ipcRenderer.invoke('files:pick', 'files'),
  pickFolder: () => ipcRenderer.invoke('files:pick', 'folder'),
  pickDestination: () => ipcRenderer.invoke('files:pick', 'destination'),
  startTransfer: (request) => ipcRenderer.invoke('transfer:start', request),
  cancelTransfer: (id) => ipcRenderer.invoke('transfer:cancel', id),
  onTransfer: (cb) => subscribe<TransferUpdate>('transfer:updated', cb),
  getDroppedPaths: (files) => {
    const paths: string[] = []
    for (const file of files) {
      try {
        const value = webUtils.getPathForFile(file as never)
        if (value) paths.push(value)
      } catch {
        continue
      }
    }
    return paths
  },
  captureShot: (name) => ipcRenderer.invoke('shot:capture', name),
  finishShots: () => ipcRenderer.invoke('shot:finish'),
}

contextBridge.exposeInMainWorld('phoneMirror', api)
