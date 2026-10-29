import { createServer } from 'node:http'
import { createHash, sign } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { basename, resolve, dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { extractFile } from '@electron/asar'
import { _electron as electron } from 'playwright'

if (process.platform !== 'win32') throw new Error('Installed NSIS update must run on Windows')
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => { if (value.startsWith('--')) pairs.push([value.slice(2), list[index + 1]]); return pairs }, []))
if (!args.installed || !args.installer || !args.data) throw new Error('Usage: node scripts/windows-loopback-upgrade.mjs --installed <TuneVault.exe> --installer <N+1.exe> --data <isolated userData>')
const installer = resolve(args.installer)
const filename = basename(installer)
const match = /^TuneVault-(\d+\.\d+\.\d+)-win-x64\.exe$/.exec(filename)
if (!match) throw new Error('Installer name must contain the next stable version')
const version = match[1]
const size = (await stat(installer)).size
const hash = createHash('sha512'); for await (const chunk of createReadStream(installer)) hash.update(chunk)
const sha512 = hash.digest('base64')
const envelope = Buffer.from(JSON.stringify({ schema: 1, channel: 'stable', version, notes: 'Disposable local installed-update test', minimumOS: { darwin: '14.0.0', win32: '10.0.19045' }, assets: { 'win32-x64': { name: filename, url: `https://github.com/nathanialhenniges/tunevault/releases/download/v${version}/${filename}`, size, sha512 } } }))
const signature = Buffer.from(`${sign(null, envelope, await readFile('tests/fixtures/update-test-private.pem', 'utf8')).toString('base64')}\n`)
const feed = Buffer.from(`version: ${version}\nfiles:\n  - url: ${filename}\n    sha512: ${sha512}\n    size: ${size}\npath: ${filename}\nsha512: ${sha512}\nreleaseDate: '${new Date().toISOString()}'\n`)
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  const data = path === '/release-envelope.json' ? envelope : path === '/release-envelope.sig' ? signature : path === '/latest.yml' ? feed : null
  if (data) { response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length }); response.end(data); return }
  if (path === `/${filename}`) { response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': size }); createReadStream(installer).pipe(response); return }
  response.writeHead(404); response.end()
})
await new Promise((yes, no) => { server.once('error', no); server.listen(19753, '127.0.0.1', yes) })
let app
try {
  app = await electron.launch({ executablePath: resolve(args.installed), env: { ...process.env, TUNEVAULT_TEST_DATA: resolve(args.data), TUNEVAULT_E2E: '1' }, timeout: 60_000 })
  const window = await app.firstWindow()
  await window.waitForFunction(() => Boolean(window.tunevault))
  const checked = await window.evaluate(() => window.tunevault.invoke('updates.check'))
  if (checked.status !== 'available' || checked.version !== version) throw new Error('Authenticated loopback release was not offered; use the separate installer-test artifact')
  const downloaded = await window.evaluate(() => window.tunevault.invoke('updates.download'))
  if (downloaded.status !== 'ready-to-install') throw new Error('Verified installer download did not complete')
  const exited = app.waitForEvent('close', { timeout: 90_000 })
  await window.evaluate(() => window.tunevault.invoke('updates.install')).catch(() => {})
  await exited
  app = undefined
  const deadline = Date.now() + 90_000
  let installedVersion = ''
  while (Date.now() < deadline) {
    try {
      installedVersion = JSON.parse(extractFile(join(dirname(resolve(args.installed)), 'resources/app.asar'), 'package.json').toString()).version
      if (installedVersion === version) break
    } catch { /* Installer may still be replacing locked files. */ }
    await new Promise(yes => setTimeout(yes, 1000))
  }
  if (installedVersion !== version) throw new Error('Installed application did not upgrade to authenticated version')
  // Close only the isolated test installation's automatic relaunch before Playwright's durable-data probe.
  const executableLiteral = resolve(args.installed).replaceAll("'", "''")
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$deadline=(Get-Date).AddSeconds(30); do { $owned=Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${executableLiteral}' }; if ($owned) { $owned | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; exit 0 }; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); throw 'Updated installed app did not relaunch'`], { stdio: 'inherit', timeout: 40_000 })
  console.log(`Installed NSIS authenticated loopback update reached ${version}`)
} finally { if (app) await app.close(); await new Promise(yes => server.close(yes)) }
