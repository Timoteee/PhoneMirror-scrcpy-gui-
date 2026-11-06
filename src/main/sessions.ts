import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { tryBuildScrcpyArgs, windowTitleFor } from '@shared/args'
import { explainFailure, stripAnsi } from '@shared/errors'
import { isSafeSerial } from '@shared/settings'
import type { Device, LogLine, MirrorSettings, SessionInfo } from '@shared/types'
import { toolEnv } from './paths'

interface Running {
  serial: string
  model: string
  startedAt: number
  child: ChildProcess
  stderr: string
}

export class SessionManager {
  private running = new Map<string, Running>()
  private logId = 1

  constructor(private readonly emitLog: (line: LogLine) => void, private readonly emitSessions: (sessions: SessionInfo[]) => void) {}

  list(): SessionInfo[] {
    return [...this.running.values()].map((item) => ({
      serial: item.serial,
      model: item.model,
      running: true,
      startedAt: item.startedAt,
    }))
  }

  start(scrcpy: string, adb: string, serial: string, settings: MirrorSettings, devices: Device[]) {
    if (!isSafeSerial(serial)) return { ok: false as const, error: 'That phone is not available.' }
    const device = devices.find((item) => item.serial === serial)
    if (!device) return { ok: false as const, error: 'That phone is no longer connected. Refresh the list and try again.' }
    if (device.state !== 'device') {
      return { ok: false as const, error: 'That phone is not ready yet. Unlock it and tap Allow if it asks.' }
    }
    if (this.running.has(serial)) return { ok: false as const, error: 'This phone is already mirroring.' }

    const title = windowTitleFor(device.model)
    const built = tryBuildScrcpyArgs({ settings, serial, windowTitle: title })
    if (!built.ok) return built

    let child: ChildProcess
    try {
      child = spawn(scrcpy, built.args, {
        shell: false,
        windowsHide: true,
        cwd: path.dirname(scrcpy),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: toolEnv(adb),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start scrcpy.'
      return { ok: false as const, error: explainFailure(message) ?? 'Could not start scrcpy.' }
    }
    if (!child.stdout || !child.stderr) {
      child.kill()
      return { ok: false as const, error: 'Could not read scrcpy output.' }
    }

    const entry: Running = {
      serial,
      model: device.model,
      startedAt: Date.now(),
      child,
      stderr: '',
    }
    this.running.set(serial, entry)
    this.log(device.model, 'info', `Started mirroring ${device.model}.`)
    this.emitSessions(this.list())

    let stdoutRest = ''
    let stderrRest = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutRest = this.consume(device.model, 'info', stdoutRest, chunk.toString('utf8'))
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      entry.stderr = (entry.stderr + text).slice(-8000)
      stderrRest = this.consume(device.model, 'error', stderrRest, text)
    })
    child.on('error', (err) => {
      this.log(device.model, 'error', explainFailure(err.message) ?? 'scrcpy stopped unexpectedly.')
    })
    child.on('close', (code) => {
      if (stdoutRest.trim()) this.log(device.model, 'info', stripAnsi(stdoutRest.trim()))
      if (stderrRest.trim()) this.log(device.model, 'error', stripAnsi(stderrRest.trim()))
      this.running.delete(serial)
      this.emitSessions(this.list())
      if (code === 0 || code === null) {
        this.log(device.model, 'info', `Stopped mirroring ${device.model}.`)
        return
      }
      const friendly = explainFailure(entry.stderr)
      this.log(device.model, 'error', friendly ?? `Mirroring stopped because scrcpy exited with code ${code}.`)
    })

    return { ok: true as const, message: `Mirroring ${device.model}.` }
  }

  stop(serial: string) {
    if (!isSafeSerial(serial)) return { ok: false as const, error: 'That phone is not available.' }
    const entry = this.running.get(serial)
    if (!entry) return { ok: false as const, error: 'That phone is not mirroring.' }
    entry.child.kill()
    return { ok: true as const, message: `Stopping ${entry.model}.` }
  }

  stopAll() {
    for (const entry of this.running.values()) entry.child.kill()
  }

  private consume(model: string, level: 'info' | 'error', rest: string, chunk: string): string {
    const combined = rest + chunk
    const parts = combined.split(/\r?\n/)
    const next = parts.pop() ?? ''
    for (const part of parts) {
      const text = stripAnsi(part).trim()
      if (!text) continue
      const lineLevel = level === 'error' && /error|fail|unauthorized|refused/i.test(text) ? 'error' : level === 'error' ? 'info' : level
      this.log(model, lineLevel, text)
    }
    return next
  }

  private log(source: string, level: LogLine['level'], text: string) {
    this.emitLog({
      id: this.logId++,
      ts: Date.now(),
      level,
      source,
      text,
    })
  }
}
