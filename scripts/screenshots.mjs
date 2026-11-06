import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] ?? path.join(root, 'screenshots')
mkdirSync(outDir, { recursive: true })
const require = createRequire(path.join(root, 'package.json'))
const electronPath = require('electron')

const child = spawn(electronPath, ['.', '--no-sandbox', '--disable-gpu'], {
  cwd: root,
  env: { ...process.env, PHONE_MIRROR_SCREENSHOT_DIR: outDir },
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 1))
