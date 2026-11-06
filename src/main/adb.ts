import path from 'node:path'
import { parseAdbDevices, parseWifiAddress } from '@shared/devices'
import { explainFailure, explainOrFallback, stripAnsi } from '@shared/errors'
import { isIpv4, isSafeSerial, validateHostPort, validatePairingCode } from '@shared/settings'
import type { ActionResult, Device, DeviceSnapshot } from '@shared/types'
import { toolEnv } from './paths'
import { runProcess } from './process'

function spawnMessage(error: string | undefined, stderr: string, stdout: string): string | null {
  const blob = `${error ?? ''}\n${stderr}\n${stdout}`
  return explainFailure(blob)
}

export async function listDevices(adb: string | null): Promise<DeviceSnapshot> {
  if (!adb) {
    return {
      devices: [],
      error: 'adb was not found. Reinstall Phone Mirror, or choose a scrcpy folder under Advanced.',
    }
  }
  const result = await runProcess(adb, ['devices', '-l'], { timeoutMs: 12_000, env: toolEnv(adb) })
  if (result.error && !result.stdout.includes('List of devices')) {
    return { devices: [], error: spawnMessage(result.error, result.stderr, result.stdout) ?? 'Could not list phones.' }
  }
  if (!result.stdout.includes('List of devices')) {
    return {
      devices: [],
      error: explainOrFallback(`${result.stderr}\n${result.stdout}`, 'Could not list phones.'),
    }
  }
  return { devices: parseAdbDevices(result.stdout), error: null }
}

function endpointArg(host: string, port: number): string {
  return `${host}:${port}`
}

export async function connectWifi(adb: string, host: string, portRaw: string): Promise<ActionResult> {
  const parsed = validateHostPort(host, portRaw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const target = endpointArg(parsed.host, parsed.port)
  const result = await runProcess(adb, ['connect', target], { timeoutMs: 12_000, env: toolEnv(adb) })
  const blob = stripAnsi(`${result.stdout}\n${result.stderr}\n${result.error ?? ''}`)
  const friendly = explainFailure(blob)
  const lowered = blob.toLowerCase()
  if (!result.error && (lowered.includes('connected to') || lowered.includes('already connected'))) {
    return { ok: true, message: `Connected to ${target}.` }
  }
  return { ok: false, error: friendly ?? 'Could not connect. Check the IP address and port, and that wireless debugging is turned on.' }
}

export async function pairWifi(
  adb: string,
  host: string,
  pairPortRaw: string,
  codeRaw: string,
  connectPortRaw: string,
): Promise<ActionResult> {
  const hostPort = validateHostPort(host, pairPortRaw)
  if ('error' in hostPort) return { ok: false, error: hostPort.error }
  const code = validatePairingCode(codeRaw)
  if ('error' in code) return { ok: false, error: code.error }
  const connect = validateHostPort(host, connectPortRaw)
  if ('error' in connect) return { ok: false, error: connect.error }

  const pairTarget = endpointArg(hostPort.host, hostPort.port)
  const paired = await runProcess(adb, ['pair', pairTarget, code.code], { timeoutMs: 20_000, env: toolEnv(adb) })
  const pairBlob = stripAnsi(`${paired.stdout}\n${paired.stderr}\n${paired.error ?? ''}`)
  const pairOk = !paired.error && /successfully paired/i.test(pairBlob)
  if (!pairOk) {
    return {
      ok: false,
      error: explainOrFallback(pairBlob, 'Pairing failed. Check the IP address, the pairing port, and the 6-digit code on the phone.'),
    }
  }
  return connectWifi(adb, connect.host, String(connect.port))
}

async function readWifiIp(adb: string, serial: string): Promise<string | null> {
  const addr = await runProcess(adb, ['-s', serial, 'shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0'], {
    timeoutMs: 8_000,
    env: toolEnv(adb),
  })
  const route = await runProcess(adb, ['-s', serial, 'shell', 'ip', 'route'], {
    timeoutMs: 8_000,
    env: toolEnv(adb),
  })
  return parseWifiAddress(addr.stdout, route.stdout)
}

export async function switchUsbToWifi(
  adb: string,
  serial: string,
  portRaw: string,
  devices: Device[],
): Promise<ActionResult> {
  if (!isSafeSerial(serial)) return { ok: false, error: 'That phone is not available.' }
  const device = devices.find((item) => item.serial === serial)
  if (!device || device.connection !== 'usb' || device.state !== 'device') {
    return { ok: false, error: 'Select a USB phone that is ready, then try again.' }
  }
  const port = validateHostPort('127.0.0.1', portRaw)
  if ('error' in port) return { ok: false, error: port.error }

  const tcpip = await runProcess(adb, ['-s', serial, 'tcpip', String(port.port)], {
    timeoutMs: 12_000,
    env: toolEnv(adb),
  })
  const tcpBlob = stripAnsi(`${tcpip.stdout}\n${tcpip.stderr}`)
  if (tcpip.error || (!/restarting in tcp mode/i.test(tcpBlob) && tcpip.code !== 0)) {
    return { ok: false, error: explainOrFallback(tcpBlob, 'Could not switch the phone to Wi-Fi. Keep the cable plugged in and try again.') }
  }

  const ip = await readWifiIp(adb, serial)
  if (!ip || !isIpv4(ip)) {
    return {
      ok: false,
      error: `The phone is listening on port ${port.port}, but its Wi-Fi address could not be found. Connect the phone to Wi-Fi and try again.`,
    }
  }
  await delay(800)
  return connectWifi(adb, ip, String(port.port))
}

export async function disconnectWifi(adb: string, serial: string, devices: Device[]): Promise<ActionResult> {
  if (!isSafeSerial(serial)) return { ok: false, error: 'That phone is not available.' }
  const device = devices.find((item) => item.serial === serial)
  if (!device || device.connection !== 'wifi') {
    return { ok: false, error: 'That phone is not a Wi-Fi connection.' }
  }
  const result = await runProcess(adb, ['disconnect', serial], { timeoutMs: 8_000, env: toolEnv(adb) })
  const blob = stripAnsi(`${result.stdout}\n${result.stderr}`)
  if (result.error) return { ok: false, error: explainOrFallback(blob, 'Could not disconnect that phone.') }
  return { ok: true, message: `Disconnected ${serial}.` }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sameFolderAdb(scrcpy: string): string {
  return path.join(path.dirname(scrcpy), process.platform === 'win32' ? 'adb.exe' : 'adb')
}
