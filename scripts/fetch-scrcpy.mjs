import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync, readdirSync, renameSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const VERSION = '5.0.1'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = `https://github.com/Genymobile/scrcpy/releases/download/v${VERSION}`

const assets = [
  {
    file: `scrcpy-win64-v${VERSION}.zip`,
    dest: path.join(ROOT, 'resources', 'scrcpy-win64'),
    binary: 'scrcpy.exe',
    kind: 'zip',
  },
  {
    file: `scrcpy-linux-x86_64-v${VERSION}.tar.gz`,
    dest: path.join(ROOT, 'resources', 'scrcpy-host'),
    binary: 'scrcpy',
    kind: 'tar',
  },
]

async function download(url, dest) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'phone-mirror-build' } })
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function flatten(dir) {
  const entries = readdirSync(dir)
  if (entries.length !== 1) return
  const nested = path.join(dir, entries[0])
  if (!statSync(nested).isDirectory()) return
  for (const name of readdirSync(nested)) {
    renameSync(path.join(nested, name), path.join(dir, name))
  }
  rmSync(nested, { recursive: true, force: true })
}

async function fetchAsset(asset, sums) {
  const marker = path.join(asset.dest, '.version')
  const binary = path.join(asset.dest, asset.binary)
  if (existsSync(binary) && existsSync(marker) && readFileSync(marker, 'utf8').trim() === VERSION) {
    console.log(`scrcpy ${VERSION} already present in ${asset.dest}`)
    return
  }
  mkdirSync(path.join(ROOT, 'resources', 'downloads'), { recursive: true })
  const archive = path.join(ROOT, 'resources', 'downloads', asset.file)
  console.log(`Downloading ${asset.file}`)
  await download(`${BASE}/${asset.file}`, archive)
  const expected = sums.get(asset.file)
  const actual = sha256(archive)
  if (!expected) throw new Error(`No checksum published for ${asset.file}`)
  if (actual !== expected) throw new Error(`Checksum mismatch for ${asset.file}\n expected ${expected}\n actual   ${actual}`)
  rmSync(asset.dest, { recursive: true, force: true })
  mkdirSync(asset.dest, { recursive: true })
  await extractArchive(asset, archive)
  flatten(asset.dest)
  if (!existsSync(binary)) throw new Error(`Expected ${binary} after extract`)
  if (process.platform !== 'win32' && asset.binary === 'scrcpy') {
    chmodSync(binary, 0o755)
    const adb = path.join(asset.dest, 'adb')
    if (existsSync(adb)) chmodSync(adb, 0o755)
  }
  const licenseSrc = path.join(ROOT, 'third_party', 'scrcpy', 'LICENSE')
  if (!existsSync(path.join(asset.dest, 'LICENSE')) && existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, path.join(asset.dest, 'LICENSE'))
  }
  writeFileSync(marker, `${VERSION}\n`)
  console.log(`Installed ${asset.file}`)
}

async function extractArchive(asset, archive) {
  if (asset.kind === 'zip') {
    await extractZip(archive, asset.dest)
    return
  }
  await execFileAsync('tar', ['-xzf', archive, '-C', asset.dest])
}

async function extractZip(archive, dest) {
  if (process.platform === 'win32') {
    // Windows does not ship unzip. The system tar (bsdtar) reads zip files.
    const systemTar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    if (existsSync(systemTar)) {
      await execFileAsync(systemTar, ['-xf', archive, '-C', dest])
      return
    }
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:PM_ARCHIVE -DestinationPath $env:PM_DEST -Force'],
      { env: { ...process.env, PM_ARCHIVE: archive, PM_DEST: dest } },
    )
    return
  }
  await execFileAsync('unzip', ['-q', archive, '-d', dest])
}

async function ensureLicense() {
  const dest = path.join(ROOT, 'third_party', 'scrcpy', 'LICENSE')
  if (existsSync(dest)) return
  mkdirSync(path.dirname(dest), { recursive: true })
  await download(`https://raw.githubusercontent.com/Genymobile/scrcpy/v${VERSION}/LICENSE`, dest)
}

async function main() {
  await ensureLicense()
  const sumsFile = path.join(ROOT, 'resources', 'downloads', 'SHA256SUMS.txt')
  mkdirSync(path.dirname(sumsFile), { recursive: true })
  console.log('Downloading SHA256SUMS.txt')
  await download(`${BASE}/SHA256SUMS.txt`, sumsFile)
  const sums = new Map()
  for (const line of readFileSync(sumsFile, 'utf8').split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(\S+)/.exec(line.trim())
    if (match) sums.set(match[2], match[1])
  }
  for (const asset of assets) {
    // The Linux tarball is for development on Linux and macOS, and for the Linux packages.
    if (asset.kind === 'tar' && process.platform === 'win32') continue
    await fetchAsset(asset, sums)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
