import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => { if (value.startsWith('--')) pairs.push([value.slice(2), list[index + 1]]); return pairs }, []))
const platform = args.platform || process.platform
if (platform !== process.platform || !['darwin', 'win32'].includes(platform)) throw new Error('Installer upgrades must run natively on a supported OS')
if (!args.from || !args.to) throw new Error('Usage: node scripts/installed-upgrade.mjs --from <N installer> --to <N+1 installer>')
const root = await mkdtemp(join(tmpdir(), 'tunevault-installed-upgrade-'))
const data = join(root, 'userData')
const installation = join(root, 'installed')
await mkdir(data); await mkdir(installation)
const test = async (executable, phase) => {
  const child = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/installed.spec.ts'], { stdio: 'inherit', timeout: 180_000, env: { ...process.env, TUNEVAULT_EXECUTABLE: executable, TUNEVAULT_TEST_DATA: data, TUNEVAULT_E2E: '1', TUNEVAULT_UPGRADE_PHASE: phase } })
  if (child.status !== 0) throw new Error(`Installed ${phase} E2E failed (${child.status})`)
}
async function installDMG(path) {
  const mount = join(root, 'mounted')
  await mkdir(mount, { recursive: true })
  execFileSync('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, resolve(path)], { stdio: 'inherit', timeout: 120_000 })
  try {
    const destination = join(installation, 'TuneVault.app')
    await rm(destination, { recursive: true, force: true })
    execFileSync('/usr/bin/ditto', [join(mount, 'TuneVault.app'), destination], { stdio: 'inherit', timeout: 120_000 })
    return join(destination, 'Contents/MacOS/TuneVault')
  } finally { execFileSync('/usr/bin/hdiutil', ['detach', mount], { stdio: 'inherit', timeout: 30_000 }) }
}
try {
  if (platform === 'darwin') {
    await test(await installDMG(args.from), 'seed')
    await test(await installDMG(args.to), 'verify')
  } else {
    execFileSync(resolve(args.from), ['/S', `/D=${installation}`], { stdio: 'inherit', timeout: 120_000 })
    const executable = join(installation, 'TuneVault.exe')
    await test(executable, 'seed')
    // The E2E authenticated-update phase must host a disposable signed envelope and invoke production update commands.
    const child = spawnSync(process.execPath, ['scripts/windows-loopback-upgrade.mjs', '--installed', executable, '--installer', resolve(args.to), '--data', data], { stdio: 'inherit', timeout: 240_000, env: process.env })
    if (child.status !== 0) throw new Error('Authenticated installed NSIS update failed')
    await test(executable, 'verify')
    const uninstall = join(installation, 'Uninstall TuneVault.exe')
    execFileSync(uninstall, ['/S'], { stdio: 'inherit', timeout: 120_000 })
    if (!(await readFile(join(data, 'upgrade-assertions.json'), 'utf8')).length) throw new Error('Uninstall did not retain expected user data')
  }
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  const candidateName = `TuneVault-${pkg.version}-${platform === 'darwin' ? 'mac' : 'win'}-${process.arch}.${platform === 'darwin' ? 'dmg' : 'exe'}`
  let artifact = null
  try {
    const candidate = await readFile(join('dist', candidateName))
    artifact = { name: candidateName, size: candidate.length, sha512: createHash('sha512').update(candidate).digest('base64') }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const evidence = { platform: `${platform}-${process.arch}`, version: pkg.version, packaged: true, installedUpgrade: true, artifact, timestamp: new Date().toISOString(), method: platform === 'darwin' ? 'DMG mount/copy/launch and manual replacement' : 'NSIS install/authenticated update/relaunch/uninstall-retains-data' }
  await mkdir('test-results', { recursive: true })
  await writeFile(`test-results/evidence-${platform}-${process.arch}.json`, JSON.stringify(evidence, null, 2))
  if (!artifact) console.log('Installed upgrade passed; no production candidate artifact exists yet, so this evidence cannot pass release promotion.')
} finally { if (process.env.TUNEVAULT_KEEP_UPGRADE_FIXTURE !== '1') await rm(root, { recursive: true, force: true }) }
