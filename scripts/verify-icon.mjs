import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

if (process.platform !== 'darwin') throw new Error('Native Icon Composer verification requires macOS and Xcode26+')
const root = resolve('build/TuneVault.icon')
assert.deepEqual(await readFile(join(root, 'Assets/wolf-concept.png')), await readFile('resources/icon.png'), 'Original generated PNG provenance must remain intact')
const temporary = await mkdtemp(join(tmpdir(), 'tunevault-icon-'))
try {
  execFileSync('/usr/bin/xcrun', ['actool', root, '--compile', temporary, '--output-format', 'human-readable-text', '--output-partial-info-plist', join(temporary, 'info.plist'), '--app-icon', 'TuneVault', '--include-all-app-icons', '--target-device', 'mac', '--minimum-deployment-target', '26.0', '--platform', 'macosx'], { stdio: 'inherit', timeout: 120_000 })
  assert((await stat(join(temporary, 'Assets.car'))).size > 100_000)
  assert((await stat(join(temporary, 'TuneVault.icns'))).size > 1000)
  const catalog = JSON.parse(execFileSync('/usr/bin/assetutil', ['--info', join(temporary, 'Assets.car')], { encoding: 'utf8' }))
  const appearances = new Set(catalog.filter(entry => entry.AssetType === 'IconImageStack').map(entry => entry.Appearance))
  for (const appearance of ['NSAppearanceNameAqua', 'NSAppearanceNameDarkAqua', 'ISAppearanceTintable']) assert(appearances.has(appearance), `Native icon appearance missing: ${appearance}`)
  console.log('Icon Composer catalog contains native Aqua, DarkAqua, tintable stacks and legacy ICNS; original PNG bytes unchanged.')
} finally { await rm(temporary, { recursive: true, force: true }) }
