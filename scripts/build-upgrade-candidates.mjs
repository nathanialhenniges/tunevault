import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const current = pkg.version
if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error('Stable version required for upgrade fixture')
const parts = current.split('.').map(Number); parts[2]++
const next = parts.join('.')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
execFileSync(npm, ['run', 'build'], { stdio: 'inherit', env: { ...process.env, TUNEVAULT_INSTALLER_TEST: '1' } })
const builder = resolve('node_modules/electron-builder/cli.js')
const platform = process.platform === 'darwin' ? 'mac' : 'win'
const extension = process.platform === 'darwin' ? 'dmg' : 'exe'
for (const version of [current, next]) execFileSync(process.execPath, [builder, `--${platform}`, `--${process.arch}`, '--publish', 'never', `--config.extraMetadata.version=${version}`, `--config.directories.output=dist/installer-test/${version}`], { stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } })
execFileSync(process.execPath, ['scripts/installed-upgrade.mjs', '--from', join('dist/installer-test', current, `TuneVault-${current}-${platform}-${process.arch}.${extension}`), '--to', join('dist/installer-test', next, `TuneVault-${next}-${platform}-${process.arch}.${extension}`)], { stdio: 'inherit' })
