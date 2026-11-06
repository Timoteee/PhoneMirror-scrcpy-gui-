import { isIpv4 } from './settings'
import type { Device, DeviceConnection, DeviceState } from './types'

const KNOWN_STATES = new Set<DeviceState>(['device', 'unauthorized', 'offline', 'authorizing', 'connecting'])

function stateOf(value: string): DeviceState {
  return KNOWN_STATES.has(value as DeviceState) ? (value as DeviceState) : 'unknown'
}

function connectionOf(serial: string, props: Record<string, string>): DeviceConnection {
  if (serial.startsWith('emulator-')) return 'emulator'
  if (props.usb) return 'usb'
  if (serial.includes(':') || serial.includes('_adb-tls') || serial.includes('._tcp')) return 'wifi'
  return 'usb'
}

function modelOf(props: Record<string, string>): string {
  const raw = props.model || props.product || ''
  const cleaned = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Android phone'
}

export function parseAdbDevices(output: string): Device[] {
  const devices: Device[] = []
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('List of devices') || trimmed.startsWith('*')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    const serial = parts[0] ?? ''
    const state = parts[1] ?? ''
    if (!/^[A-Za-z0-9._:-]+$/.test(serial)) continue
    const props: Record<string, string> = {}
    for (const part of parts.slice(2)) {
      const idx = part.indexOf(':')
      if (idx > 0) props[part.slice(0, idx)] = part.slice(idx + 1)
    }
    devices.push({
      serial,
      state: stateOf(state),
      model: modelOf(props),
      connection: connectionOf(serial, props),
    })
  }
  return devices
}

export function parseWifiAddress(addrOutput: string, routeOutput: string): string | null {
  const inet = addrOutput.match(/\binet\s+(\d{1,3}(?:\.\d{1,3}){3})\b/)
  if (inet?.[1] && isIpv4(inet[1]) && !inet[1].startsWith('127.')) return inet[1]

  const lines = routeOutput.split(/\r?\n/)
  const wlan = lines.find((line) => /\bwlan\d*\b/.test(line) && line.includes('src '))
  if (wlan) {
    const match = wlan.match(/\bsrc\s+(\d{1,3}(?:\.\d{1,3}){3})\b/)
    if (match?.[1] && isIpv4(match[1]) && !match[1].startsWith('127.')) return match[1]
  }

  for (const match of routeOutput.matchAll(/\bsrc\s+(\d{1,3}(?:\.\d{1,3}){3})\b/g)) {
    const ip = match[1]
    if (ip && isIpv4(ip) && !ip.startsWith('127.') && !ip.startsWith('0.')) return ip
  }
  return null
}
