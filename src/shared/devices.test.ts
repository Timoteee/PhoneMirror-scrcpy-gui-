import { describe, expect, it } from 'vitest'
import { parseAdbDevices, parseWifiAddress } from './devices'
import { explainFailure } from './errors'

const SAMPLE = `
List of devices attached
R5CW123ABC             device usb:1-2 product:husky model:Pixel_8 device:husky transport_id:4
192.168.1.42:5555      device product:dm3q model:SM_S918B device:dm3q transport_id:5
emulator-5554          offline product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:1
adb-8C9A._adb-tls-connect._tcp device product:panther model:Pixel_7 device:panther transport_id:8
ABCDEF                 unauthorized usb:1-3 transport_id:6
* daemon not running; starting now at tcp:5037
`

describe('parseAdbDevices', () => {
  it('reads model, connection, and state from adb devices -l', () => {
    const devices = parseAdbDevices(SAMPLE)
    expect(devices).toEqual([
      { serial: 'R5CW123ABC', state: 'device', model: 'Pixel 8', connection: 'usb' },
      { serial: '192.168.1.42:5555', state: 'device', model: 'SM S918B', connection: 'wifi' },
      { serial: 'emulator-5554', state: 'offline', model: 'sdk gphone64 x86 64', connection: 'emulator' },
      { serial: 'adb-8C9A._adb-tls-connect._tcp', state: 'device', model: 'Pixel 7', connection: 'wifi' },
      { serial: 'ABCDEF', state: 'unauthorized', model: 'Android phone', connection: 'usb' },
    ])
  })

  it('ignores lines that are not device rows', () => {
    expect(parseAdbDevices('List of devices attached\n\n* daemon started successfully\n')).toEqual([])
  })

  it('reads a Linux USB permission failure', () => {
    const output = 'List of devices attached\nR5CW123ABC    no permissions (missing udev rules? user is not in the plugdev group); see [http://developer.android.com/tools/device.html]\n'
    expect(parseAdbDevices(output)).toEqual([{ serial: 'R5CW123ABC', state: 'no-permissions', model: 'Android phone', connection: 'usb' }])
  })
})

describe('parseWifiAddress', () => {
  it('prefers the wlan inet address', () => {
    const addr = '3: wlan0: <BROADCAST>\n    inet 192.168.1.23/24 brd 192.168.1.255 scope global wlan0'
    const route = '10.0.0.0/8 dev rmnet0 proto kernel scope link src 10.1.2.3\n192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.23'
    expect(parseWifiAddress(addr, route)).toBe('192.168.1.23')
  })

  it('falls back to the wlan route source', () => {
    const route = '192.168.0.0/24 dev wlan0 proto kernel scope link src 192.168.0.15'
    expect(parseWifiAddress('', route)).toBe('192.168.0.15')
  })

  it('returns null when the phone has no usable address', () => {
    expect(parseWifiAddress('inet 127.0.0.1/8', 'src 127.0.0.1')).toBeNull()
  })
})

describe('explainFailure', () => {
  it('explains an unauthorized phone', () => {
    expect(explainFailure('error: device unauthorized.')).toMatch(/tap Allow/i)
  })

  it('explains a missing phone', () => {
    expect(explainFailure('ERROR: Could not find any ADB device')).toMatch(/No phone is connected/)
  })

  it('explains a Linux USB permission failure', () => {
    expect(explainFailure('adb: insufficient permissions for device')).toMatch(/plugdev/i)
  })

  it('explains a missing adb binary', () => {
    expect(explainFailure('spawn adb ENOENT')).toMatch(/not found/i)
  })

  it('explains a refused wireless connection', () => {
    expect(explainFailure('cannot connect to 192.168.1.20:5555: Connection refused')).toMatch(/Could not connect/)
  })

  it('ignores ordinary log text', () => {
    expect(explainFailure('INFO: Device: Pixel 8 (Android 15)')).toBeNull()
  })
})
