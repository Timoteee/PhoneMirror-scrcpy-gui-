import type { Device, LogLine } from '@shared/types'

export const SAMPLE_DEVICES: Device[] = [
  { serial: 'R5CW123ABC', state: 'device', model: 'Pixel 8', connection: 'usb' },
  { serial: '192.168.1.42:5555', state: 'device', model: 'Galaxy S23', connection: 'wifi' },
  { serial: 'ABCDEF123456', state: 'unauthorized', model: 'Nothing Phone (2)', connection: 'usb' },
]

export type ShotName = 'main-light' | 'settings-light' | 'wireless-light' | 'empty-light' | 'main-dark' | 'log-error-light'

export interface ShotStep {
  name: ShotName
  theme: 'light' | 'dark'
  devices: 'sample' | 'empty' | 'error'
  wireless: boolean
  expand: Array<'picture' | 'sound' | 'window' | 'input' | 'capture' | 'advanced'>
  log: boolean
}

export const SHOTS: ShotStep[] = [
  { name: 'main-light', theme: 'light', devices: 'sample', wireless: false, expand: [], log: false },
  { name: 'settings-light', theme: 'light', devices: 'sample', wireless: false, expand: ['picture'], log: false },
  { name: 'wireless-light', theme: 'light', devices: 'sample', wireless: true, expand: [], log: false },
  { name: 'empty-light', theme: 'light', devices: 'empty', wireless: false, expand: [], log: false },
  { name: 'main-dark', theme: 'dark', devices: 'sample', wireless: false, expand: [], log: false },
  { name: 'log-error-light', theme: 'light', devices: 'sample', wireless: false, expand: [], log: true },
]

export function sampleLog(now = Date.now()): LogLine[] {
  return [
    { id: 1, ts: now - 4000, level: 'info', source: 'Pixel 8', text: 'Started mirroring Pixel 8.' },
    { id: 2, ts: now - 2000, level: 'error', source: 'scrcpy', text: 'ERROR: Device unauthorized' },
    {
      id: 3,
      ts: now - 1000,
      level: 'error',
      source: 'Phone Mirror',
      text: 'This phone has not been allowed yet. Unlock it and tap Allow on the USB debugging prompt.',
    },
  ]
}
