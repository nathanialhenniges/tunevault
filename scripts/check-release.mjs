import { createHash, verify } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] || 'dist/release-candidate')
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const bytes = await readFile(join(root, 'release-envelope.json'))
const signature = Buffer.from((await readFile(join(root, 'release-envelope.sig'), 'utf8')).trim(), 'base64')
const { publicKeys } = JSON.parse(await readFile('resources/update-keys.json', 'utf8'))
if (!publicKeys.length || signature.length !== 64 || !publicKeys.some(key => verify(null, bytes, key, signature))) throw new Error('Production release signature missing/invalid')
const envelope = JSON.parse(bytes)
if (envelope.schema !== 1 || envelope.channel !== 'stable' || envelope.version !== pkg.version) throw new Error('Release/package schema or version mismatch')
for (const platform of ['darwin-arm64', 'darwin-x64', 'win32-x64']) {
  const asset = envelope.assets[platform]
  if (!asset || !/^[A-Za-z0-9._-]+$/.test(asset.name)) throw new Error(`Missing ${platform} artifact`)
  if (asset.url !== `https://github.com/nathanialhenniges/tunevault/releases/download/v${pkg.version}/${asset.name}`) throw new Error('Wrong artifact URL')
  const file = await readFile(join(root, asset.name))
  if (file.length !== asset.size || createHash('sha512').update(file).digest('base64') !== asset.sha512) throw new Error(`Wrong ${platform} hash/size`)
  const evidence = JSON.parse(await readFile(join(root, `evidence-${platform}.json`), 'utf8'))
  if (evidence.version !== pkg.version || evidence.platform !== platform || evidence.packaged !== true || evidence.installedUpgrade !== true) throw new Error(`Required native packaging/installed upgrade evidence absent: ${platform}`)
  if (JSON.stringify(evidence.artifact) !== JSON.stringify({ name: asset.name, size: asset.size, sha512: asset.sha512 })) throw new Error(`Native evidence is for a different artifact: ${platform}`)
}
for (const file of ['THIRD_PARTY_NOTICES.md', 'LICENSE', 'release-notes.md']) if ((await stat(join(root, file))).size < 20) throw new Error(`Missing ${file}`)
console.log(`Release ${pkg.version} candidate signature, matrix evidence, and all artifacts verified. Nothing was published.`)
