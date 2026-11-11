import { spawn, type ChildProcess } from 'node:child_process'

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
  error?: string
  /** True when output hit the cap and the tail was dropped. */
  truncated?: boolean
}

export function runProcess(
  exe: string,
  args: string[],
  options: { timeoutMs: number; env?: NodeJS.ProcessEnv; maxOutput?: number },
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(exe, args, {
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: options.env,
      })
    } catch (err) {
      resolve({
        code: null,
        stdout: '',
        stderr: '',
        error: err instanceof Error ? err.message : 'Could not start the program.',
      })
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false
    let truncated = false
    const cap = options.maxOutput ?? 200_000
    const finish = (result: ProcessResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(truncated ? { ...result, truncated: true } : result)
    }
    const timer = setTimeout(() => {
      child.kill()
      finish({ code: null, stdout, stderr, error: 'The command timed out.' })
    }, options.timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < cap) stdout += chunk.toString('utf8')
      else truncated = true
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < cap) stderr += chunk.toString('utf8')
      else truncated = true
    })
    child.on('error', (err) => {
      finish({ code: null, stdout, stderr, error: err.message })
    })
    child.on('close', (code) => {
      finish({ code, stdout, stderr })
    })
  })
}
