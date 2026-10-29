import { readdir, mkdir, copyFile, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
const destination = 'dist/release-candidate'
await mkdir(destination, { recursive: true })
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (/\.(dmg|exe|yml)$/.test(entry.name) || /^evidence-(darwin-(arm64|x64)|win32-x64)\.json$/.test(entry.name)) await copyFile(path, join(destination, basename(path)))
  }
}
await collect('dist/downloaded-candidates')
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) await copyFile(name, join(destination, name))
if (!process.env.RELEASE_NOTES?.trim()) throw new Error('Release notes required')
await writeFile(join(destination, 'release-notes.md'), `${process.env.RELEASE_NOTES.trim()}\n`)
