import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, chmod, stat, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const platform = process.argv[2] || process.platform
const arch = process.argv[3] || process.arch
const key = `${platform}-${arch}`
const lock = JSON.parse(await readFile(new URL('../resources/tools/lock.json', import.meta.url), 'utf8'))
const entries = lock.platforms[key]
if (!entries) throw new Error(`Unsupported tools target: ${key}`)
const root = resolve('resources/tools', key)
await mkdir(root, { recursive: true })
const manifest = { schema: 1, platform, arch, ejs: '0.8.0 (inside yt-dlp 2026.10.26)', entries: [] }
for (const entry of entries) {
  const filename = entry.name + (!entry.notice && platform === 'win32' ? '.exe' : '')
  const path = join(root, filename)
  const download = join(root, `${filename}.download`)
  let bytes
  try {
    bytes = await readFile(entry.archive ? download : path)
    if (bytes.length !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) bytes = undefined
  } catch { /* Fetch the exact pinned asset when absent. */ }
  if (!bytes) {
    console.log(`Downloading ${key}/${entry.name} ${entry.version || ''}`)
    const response = await fetch(entry.url, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`Tool download failed: ${response.status}`)
    if (Number(response.headers.get('content-length')) > entry.size) throw new Error('Tool exceeds pinned size')
    bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Pinned digest mismatch: ${entry.name}`)
    await writeFile(entry.archive ? download : path, bytes)
  }
  if (entry.archive) {
    const extraction = join(root, '.deno-extract')
    await mkdir(extraction, { recursive: true })
    if (process.platform === 'win32') {
      const quote = value => value.replaceAll("'", "''")
      const zip = `${download}.zip`
      await writeFile(zip, bytes)
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${quote(zip)}' -DestinationPath '${quote(extraction)}' -Force`])
      await rm(zip)
    } else execFileSync('/usr/bin/unzip', ['-o', '-q', download, entry.entry, '-d', extraction])
    await writeFile(path, await readFile(join(extraction, entry.entry)))
    await rm(extraction, { recursive: true, force: true })
  }
  if (!entry.notice) {
    if (process.platform !== 'win32') await chmod(path, 0o755)
    const final = await readFile(path)
    manifest.entries.push({ name: entry.name, file: filename, sha256: createHash('sha256').update(final).digest('hex'), size: (await stat(path)).size, version: entry.version, sourceUrl: entry.url, license: entry.license })
  }
}
if (platform === 'darwin') {
  if (process.platform !== platform || process.arch !== arch) throw new Error('macOS FFmpeg must be built on its native architecture')
  try {
    const build = JSON.parse(await readFile(join(root, 'ffmpeg-build.json'), 'utf8'))
    const recipeSHA256 = createHash('sha256').update(await readFile(new URL('./build-ffmpeg.mjs', import.meta.url))).digest('hex')
    if (build.version !== lock.macFFmpegBuild.version || build.recipeSHA256 !== recipeSHA256) throw new Error('Rebuild required')
    for (const name of ['ffmpeg', 'ffprobe']) {
      const output = execFileSync(join(root, name), ['-version'], { encoding: 'utf8', env: { ...process.env, PATH: '' } })
      if (!output.includes('8.0.1') || output.includes('--enable-nonfree')) throw new Error('Unacceptable FFmpeg')
    }
  } catch { execFileSync(process.execPath, ['scripts/build-ffmpeg.mjs'], { stdio: 'inherit' }) }
  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = join(root, name), bytes = await readFile(path)
    manifest.entries.push({ name, file: name, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, version: lock.macFFmpegBuild.version, sourceUrl: 'https://ffmpeg.org/releases/ffmpeg-8.0.1.tar.xz', license: lock.macFFmpegBuild.license })
  }
}
await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Prepared pinned tools at ${root}`)
