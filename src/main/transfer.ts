import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { explainFailure } from '@shared/errors'
import { isSafeSerial } from '@shared/settings'
import {
  deviceBasename,
  isSafeDevicePath,
  joinDevicePath,
  measuredPercent,
  nextFreeName,
  parseTransferPercent,
  pullDestination,
  pushDestination,
  shellQuoteDevicePath,
  type StartTransferResult,
  type TransferDirection,
  type TransferRequest,
  type TransferState,
  type TransferUpdate,
} from '@shared/transfer'
import type { ActionResult, LogLine } from '@shared/types'
import { toolEnv } from './paths'
import { runProcess } from './process'

/** Where our own progress measurement looks, because adb prints no percentages into a pipe. */
interface Meter {
  side: 'device' | 'local'
  path: string
  /** Bytes expected in total, or 'device' when the size has to be asked of the phone first. */
  total: number | 'device'
}

type Job =
  | { kind: 'push'; label: string; local: string; target: string; meter?: Meter }
  | { kind: 'install'; label: string; local: string }
  | { kind: 'pull'; label: string; device: string; destination: string; meter?: Meter }

interface Active {
  id: string
  serial: string
  direction: TransferDirection
  model: string
  jobs: Job[]
  index: number
  percent: number | null
  label: string
  cancelled: boolean
  child: ChildProcess | null
}

const MAX_LOCAL_PATH = 1024
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/
const METER_INTERVAL_MS = 500

/** Size of a file on the phone, or null when it cannot be read. */
async function deviceFileSize(adb: string, serial: string, devicePath: string): Promise<number | null> {
  const quoted = shellQuoteDevicePath(devicePath)
  if (!quoted) return null
  const result = await runProcess(adb, ['-s', serial, 'shell', 'stat', '-c', '%s', quoted], {
    timeoutMs: 8_000,
    env: toolEnv(adb),
  })
  if (result.code !== 0) return null
  const value = Number.parseInt(result.stdout.trim(), 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function localPathProblem(local: string): string | null {
  if (!local || local.length > MAX_LOCAL_PATH || CONTROL_CHARS.test(local)) {
    return 'That file cannot be read. Choose it again.'
  }
  if (!path.isAbsolute(local)) return 'That file cannot be read. Choose it again.'
  try {
    fs.statSync(local)
  } catch {
    return 'That file is no longer there. Choose it again.'
  }
  return null
}

function explainTransfer(text: string, direction: TransferDirection): string | null {
  const blob = text.toLowerCase()
  const known = explainFailure(blob)
  if (known) return known
  if (blob.includes('no space left')) return 'The phone has no space left for that file.'
  if (blob.includes('permission denied') || blob.includes('operation not permitted')) {
    return direction === 'get'
      ? 'Android does not allow adb to read that folder. Try /sdcard/Download, or copy the file in the Files app on the phone.'
      : 'Android does not allow adb to write in that folder. Try /sdcard/Download.'
  }
  if (blob.includes('read-only file system')) {
    return 'Android mounted that folder read-only. Choose another folder, such as /sdcard/Download.'
  }
  if (blob.includes('no such file') || blob.includes('does not exist')) {
    return direction === 'get' ? 'That item is no longer on the phone.' : 'That file is no longer on this PC.'
  }
  return null
}

function buildJobs(request: TransferRequest): { jobs: Job[] } | { error: string } {
  if (request.direction === 'send') {
    if (!isSafeDevicePath(request.target)) {
      return { error: 'Choose a folder on the phone, such as /sdcard/Download.' }
    }
    if (request.paths.length === 0) return { error: 'Choose at least one file or folder to send.' }
    const jobs: Job[] = []
    for (const local of request.paths) {
      const problem = localPathProblem(local)
      if (problem) return { error: problem }
      const name = path.basename(local)
      let directory = false
      try {
        directory = fs.statSync(local).isDirectory()
      } catch {
        return { error: 'That file is no longer there. Choose it again.' }
      }
      if (directory) {
        jobs.push({ kind: 'push', label: name, local, target: pushDestination(request.target, local) })
      } else if (/\.apk$/i.test(local)) {
        jobs.push({ kind: 'install', label: name, local })
      } else {
        const size = fs.statSync(local).size
        jobs.push({
          kind: 'push',
          label: name,
          local,
          target: request.target,
          meter: { side: 'device', path: joinDevicePath(request.target, name), total: size },
        })
      }
    }
    return { jobs }
  }

  if (!path.isAbsolute(request.target) || CONTROL_CHARS.test(request.target)) {
    return { error: 'Choose a folder on this PC to put the files in.' }
  }
  try {
    if (!fs.statSync(request.target).isDirectory()) {
      return { error: 'Choose a folder on this PC to put the files in.' }
    }
  } catch {
    return { error: 'That folder on this PC is no longer there. Choose it again.' }
  }
  const taken = new Set<string>()
  const jobs: Job[] = []
  for (const device of request.paths) {
    if (!isSafeDevicePath(device) || deviceBasename(device) === '') {
      return { error: 'Choose files on the phone to copy.' }
    }
    const name = nextFreeName(deviceBasename(device), (candidate) => {
      if (taken.has(candidate)) return true
      try {
        fs.statSync(path.join(request.target, candidate))
        return true
      } catch {
        return false
      }
    })
    taken.add(name)
    const destination = pullDestination(request.target, `/${name}`)
    jobs.push({
      kind: 'pull',
      label: name,
      device,
      destination,
      meter: { side: 'local', path: destination, total: 'device' },
    })
  }
  if (jobs.length === 0) return { error: 'Choose files on the phone to copy.' }
  return { jobs }
}

function jobArgs(serial: string, job: Job): string[] {
  if (job.kind === 'pull') return ['-s', serial, 'pull', job.device, job.destination]
  if (job.kind === 'install') return ['-s', serial, 'install', '-r', job.local]
  return ['-s', serial, 'push', job.local, job.target]
}

/**
 * Runs one adb push/pull/install at a time, reports integer percent from adb's own output,
 * and can be cancelled. Deliberately not `runProcess`: its 12 s timeout and 200 KB cap are
 * wrong for a transfer, and it cannot be cancelled.
 */
export class TransferManager {
  private active: Active | null = null
  private logId = 1

  constructor(
    private readonly onUpdate: (update: TransferUpdate) => void,
    private readonly onLog: (line: LogLine) => void,
  ) {}

  start(adb: string, request: TransferRequest, model: string): StartTransferResult {
    if (this.active) {
      return { ok: false, error: 'A transfer is already running. Wait for it to finish, or cancel it.' }
    }
    if (!isSafeSerial(request.serial)) return { ok: false, error: 'That phone is not available.' }
    if (request.direction !== 'send' && request.direction !== 'get') {
      return { ok: false, error: 'That transfer is not supported.' }
    }
    const built = buildJobs(request)
    if ('error' in built) return { ok: false, error: built.error }

    const active: Active = {
      id: `transfer-${Date.now().toString(36)}`,
      serial: request.serial,
      direction: request.direction,
      model,
      jobs: built.jobs,
      // The first job is what the dialog names while the process starts. index is 1-based so
      // the opening message never reads "0 of 3".
      index: 1,
      percent: null,
      label: built.jobs[0]?.label ?? '',
      cancelled: false,
      child: null,
    }
    this.active = active
    const count = active.jobs.length
    this.log(model, 'info', `${request.direction === 'send' ? 'Sending' : 'Copying'} ${count} item${count === 1 ? '' : 's'} ${request.direction === 'send' ? 'to' : 'from'} ${model}.`)
    this.publish('running')
    void this.run(adb, active)
    return { ok: true, id: active.id }
  }

  cancel(id: string): ActionResult {
    const active = this.active
    if (!active || active.id !== id) return { ok: false, error: 'That transfer has already finished.' }
    active.cancelled = true
    active.child?.kill()
    return { ok: true, message: 'Cancelling…' }
  }

  dispose() {
    this.active?.child?.kill()
    this.active = null
  }

  private async run(adb: string, active: Active) {
    for (let index = 0; index < active.jobs.length; index += 1) {
      if (active.cancelled) return this.finish('cancelled')
      const job = active.jobs[index]
      if (!job) break
      active.index = index + 1
      active.label = job.label
      active.percent = null
      this.publish('running')
      const result = await this.runJob(adb, active, job)
      if (active.cancelled) return this.finish('cancelled')
      if (result.code !== 0) {
        const reason =
          explainTransfer(result.output, active.direction) ??
          `${job.label} could not be ${active.direction === 'send' ? 'sent' : 'copied'}.`
        const done = index === 0 ? '' : `${index} of ${active.jobs.length} finished first. `
        return this.finish('failed', `${done}${reason}`)
      }
      active.percent = 100
      this.publish('running')
    }
    const count = active.jobs.length
    this.finish(
      'done',
      active.direction === 'send'
        ? `Sent ${count} item${count === 1 ? '' : 's'} to ${active.model}.`
        : `Copied ${count} item${count === 1 ? '' : 's'} from ${active.model}.`,
    )
  }

  private runJob(
    adb: string,
    active: Active,
    job: Job,
  ): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve) => {
      let child: ChildProcess
      try {
        child = spawn(adb, jobArgs(active.serial, job), {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: toolEnv(adb),
        })
      } catch (err) {
        resolve({ code: null, output: err instanceof Error ? err.message : 'Could not start adb.' })
        return
      }
      active.child = child
      let output = ''
      let settled = false
      let stopMeter = () => {}
      const finish = (result: { code: number | null; output: string }) => {
        if (settled) return
        settled = true
        stopMeter()
        if (this.active === active) active.child = null
        resolve(result)
      }
      const onChunk = (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        output = (output + text).slice(-8000)
        for (const raw of text.split(/[\r\n]+/)) {
          const line = raw.trim()
          if (line) this.log(active.model, 'info', line.slice(0, 400))
        }
        this.bump(active, parseTransferPercent(text))
      }
      child.stdout?.on('data', onChunk)
      child.stderr?.on('data', onChunk)
      child.on('error', (err) => finish({ code: null, output: `${output}\n${err.message}` }))
      child.on('close', (code) => finish({ code, output }))
      stopMeter = this.startMeter(adb, active, job)
    })
  }

  /**
   * adb prints no percentage lines when its output is a pipe, so measure the bytes on the side
   * that is receiving the file. Pulls watch the local file grow; single-file pushes ask the phone
   * how large the file is so far. Folders and installs stay indeterminate.
   */
  private startMeter(adb: string, active: Active, job: Job): () => void {
    const meter = job.kind === 'install' ? undefined : job.meter
    if (!meter) return () => {}
    let total = meter.total
    let busy = false
    const stop = () => clearInterval(timer)

    const sample = async () => {
      if (busy || active.cancelled || this.active !== active) return
      busy = true
      try {
        if (total === 'device') {
          const devicePath = job.kind === 'pull' ? job.device : meter.path
          const size = await deviceFileSize(adb, active.serial, devicePath)
          if (size && size > 0) total = size
          return
        }
        if (meter.side === 'local') {
          try {
            this.bump(active, measuredPercent(fs.statSync(meter.path).size, total))
          } catch {
            // The file appears once adb creates it; nothing to report before that.
          }
          return
        }
        const written = await deviceFileSize(adb, active.serial, meter.path)
        if (written !== null) this.bump(active, measuredPercent(written, total))
      } finally {
        busy = false
      }
    }

    const timer = setInterval(() => void sample(), METER_INTERVAL_MS)
    return stop
  }

  /** Publishes progress only when it moves forward, so two sources cannot jitter the bar. */
  private bump(active: Active, percent: number | null) {
    if (percent === null) return
    if (active.percent !== null && percent <= active.percent) return
    active.percent = percent
    this.publish('running')
  }

  private publish(state: TransferState, message?: string) {
    const active = this.active
    if (!active) return
    this.onUpdate({
      id: active.id,
      serial: active.serial,
      direction: active.direction,
      state,
      index: active.index,
      total: active.jobs.length,
      label: active.label,
      percent: active.percent,
      ...(message ? { message } : {}),
    })
  }

  private finish(state: TransferState, message?: string) {
    const active = this.active
    if (!active) return
    active.child?.kill()
    this.active = null
    this.onUpdate({
      id: active.id,
      serial: active.serial,
      direction: active.direction,
      state,
      index: Math.max(active.index, 1),
      total: active.jobs.length,
      label: active.label,
      percent: state === 'done' ? 100 : active.percent,
      ...(message ? { message } : {}),
    })
    if (state === 'failed') {
      this.log(active.model, 'error', message ?? 'The transfer stopped.')
    } else if (state === 'cancelled') {
      this.log(active.model, 'info', 'Cancelled. A partial file may be left on the phone.')
    } else {
      this.log(active.model, 'info', message ?? 'Transfer finished.')
    }
  }

  private log(source: string, level: LogLine['level'], text: string) {
    this.onLog({ id: this.logId++, ts: Date.now(), level, source, text })
  }
}
