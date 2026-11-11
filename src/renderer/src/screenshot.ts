import type { Device, LogLine } from '@shared/types'
import type { FolderListing } from '@shared/transfer'

export const SAMPLE_DEVICES: Device[] = [
  { serial: 'R5CW123ABC', state: 'device', model: 'Pixel 8', connection: 'usb' },
  { serial: '192.168.1.42:5555', state: 'device', model: 'Galaxy S23', connection: 'wifi' },
  { serial: 'ABCDEF123456', state: 'unauthorized', model: 'Nothing Phone (2)', connection: 'usb' },
]

export const SAMPLE_LISTING: FolderListing = {
  path: '/sdcard/DCIM/Camera',
  error: null,
  entries: [
    { name: 'Screenshots', path: '/sdcard/DCIM/Camera/Screenshots', size: 4096, dir: true },
    { name: 'IMG_20261111_093012.jpg', path: '/sdcard/DCIM/Camera/IMG_20261111_093012.jpg', size: 2_912_640, dir: false },
    { name: 'VID_20261110_174455.mp4', path: '/sdcard/DCIM/Camera/VID_20261110_174455.mp4', size: 48_234_496, dir: false },
    { name: 'IMG_20261109_120104.jpg', path: '/sdcard/DCIM/Camera/IMG_20261109_120104.jpg', size: 1_804_288, dir: false },
  ],
}

/** Stable reference for the shot harness: a folder, two ticked files, and a PC destination. */
export const SAMPLE_PREVIEW = {
  listing: SAMPLE_LISTING,
  selected: ['/sdcard/DCIM/Camera/IMG_20261111_093012.jpg', '/sdcard/DCIM/Camera/VID_20261110_174455.mp4'],
  destination: 'C:\\Users\\you\\Pictures',
}

export type ShotName =
  | 'main-light'
  | 'settings-light'
  | 'wireless-light'
  | 'files-light'
  | 'empty-light'
  | 'main-dark'
  | 'log-error-light'

export interface ShotStep {
  name: ShotName
  theme: 'light' | 'dark'
  devices: 'sample' | 'empty' | 'error'
  wireless: boolean
  files: boolean
  expand: Array<'picture' | 'sound' | 'window' | 'input' | 'capture' | 'advanced'>
  log: boolean
}

export const SHOTS: ShotStep[] = [
  { name: 'main-light', theme: 'light', devices: 'sample', wireless: false, files: false, expand: [], log: false },
  { name: 'settings-light', theme: 'light', devices: 'sample', wireless: false, files: false, expand: ['picture'], log: false },
  { name: 'wireless-light', theme: 'light', devices: 'sample', wireless: true, files: false, expand: [], log: false },
  { name: 'files-light', theme: 'light', devices: 'sample', wireless: false, files: true, expand: [], log: false },
  { name: 'empty-light', theme: 'light', devices: 'empty', wireless: false, files: false, expand: [], log: false },
  { name: 'main-dark', theme: 'dark', devices: 'sample', wireless: false, files: false, expand: [], log: false },
  { name: 'log-error-light', theme: 'light', devices: 'sample', wireless: false, files: false, expand: [], log: true },
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
