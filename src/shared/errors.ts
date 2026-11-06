export function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
}

export function explainFailure(text: string): string | null {
  const raw = stripAnsi(text).trim()
  if (!raw) return null
  const t = raw.toLowerCase()

  if (t.includes('unauthorized')) {
    return 'This phone has not been allowed yet. Unlock it and tap Allow on the USB debugging prompt.'
  }
  if (
    (t.includes('adb') && (t.includes('enoent') || t.includes('not found') || t.includes('no such file'))) ||
    t.includes('spawn adb') ||
    t.includes('spawn scrcpy')
  ) {
    return 'scrcpy or adb was not found. Reinstall Phone Mirror, or choose a scrcpy folder under Advanced.'
  }
  if (
    t.includes('could not find any adb device') ||
    t.includes('could not find adb device') ||
    t.includes('no devices/emulators found') ||
    t.includes('no devices') ||
    t.includes('device not found')
  ) {
    return 'No phone is connected. Plug it in with USB debugging on, or connect over Wi-Fi.'
  }
  if (t.includes('multiple') && t.includes('adb devices')) {
    return 'More than one phone is connected. Select the phone you want, then start mirroring.'
  }
  if (t.includes('device offline') || t.includes('still authorizing') || t.includes('device still connecting')) {
    return 'The phone is not ready. Unlock it, accept the debugging prompt, and try again.'
  }
  if (t.includes('failed to authenticate') || (t.includes('pairing') && (t.includes('failed') || t.includes('incorrect')))) {
    return 'Pairing failed. Check the IP address, the pairing port, and the 6-digit code on the phone.'
  }
  if (t.includes('wrong password') || t.includes('rejected')) {
    return 'The pairing code was rejected. Tap Pair device with pairing code on the phone and use the new code.'
  }
  if (
    t.includes('connection refused') ||
    t.includes('cannot connect') ||
    t.includes('failed to connect') ||
    t.includes('connection reset')
  ) {
    return 'Could not connect. Check the IP address and port, and that wireless debugging is turned on.'
  }
  if (t.includes('address already in use')) {
    return 'That port is already in use on this PC. Close other mirroring tools and try again.'
  }
  if (t.includes('server connection failed') || t.includes('could not start the server') || t.includes('server disconnected')) {
    return 'scrcpy could not start on the phone. Unlock the phone and try again. Android 5 or newer is required.'
  }
  if (t.includes('error:') && t.includes('protocol fault')) {
    return 'The connection to the phone was interrupted. Unplug it, plug it back in, and start again.'
  }
  return null
}

export function explainOrFallback(text: string, fallback: string): string {
  return explainFailure(text) ?? fallback
}
