const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return
  const dir = path.join(context.appOutDir, 'resources', 'scrcpy')
  for (const name of ['scrcpy', 'adb']) {
    const file = path.join(dir, name)
    if (!fs.existsSync(file)) throw new Error(`Bundled ${name} is missing from ${dir}`)
    fs.chmodSync(file, 0o755)
  }
  const server = path.join(dir, 'scrcpy-server')
  if (!fs.existsSync(server)) throw new Error(`Bundled scrcpy-server is missing from ${dir}`)
}
