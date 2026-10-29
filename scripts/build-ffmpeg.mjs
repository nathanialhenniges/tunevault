import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { cpus, tmpdir } from 'node:os'

if (process.platform !== 'darwin') throw new Error('This controlled FFmpeg build is for native macOS; Windows uses the pinned GPL binary')
const root = resolve('resources/tools', `${process.platform}-${process.arch}`)
const work = resolve(process.env.TUNEVAULT_BUILD_DIR || join(tmpdir(), `tunevault-ffmpeg-${process.arch}`))
const prefix = join(work, 'prefix')
await mkdir(root, { recursive: true }); await mkdir(work, { recursive: true }); await mkdir(prefix, { recursive: true })
const archives = [
  { file: 'ffmpeg-8.0.1.tar.xz', url: 'https://ffmpeg.org/releases/ffmpeg-8.0.1.tar.xz', sha256: '05ee0b03119b45c0bdb4df654b96802e909e0a752f72e4fe3794f487229e5a41' },
  { file: 'lame-3.100.tar.gz', url: 'https://deb.debian.org/debian/pool/main/l/lame/lame_3.100.orig.tar.gz', sha256: 'ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e' }
]
for (const source of archives) {
  const path = join(work, source.file)
  let bytes
  try { bytes = await readFile(path) } catch {
    try { bytes = await readFile(join(root, source.file)) } catch {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(source.url, { signal: AbortSignal.timeout(60_000) })
          if (!response.ok) throw new Error(`Source download failed ${response.status}`)
          bytes = Buffer.from(await response.arrayBuffer())
          break
        } catch (error) {
          if (attempt === 2) throw error
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000))
        }
      }
    }
  }
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error('FFmpeg source archive digest mismatch')
  await writeFile(path, bytes)
  execFileSync('/usr/bin/tar', ['-xf', path, '-C', work])
  await copyFile(path, join(root, source.file))
}
const jobs = String(Math.min(8, cpus().length))
const run = (file, args, cwd, env = process.env) => execFileSync(file, args, { cwd, env, stdio: 'inherit' })
const lame = join(work, 'lame-3.100')
run('./configure', [`--prefix=${prefix}`, '--disable-shared', '--enable-static', '--disable-frontend', '--disable-dependency-tracking'], lame)
run('/usr/bin/make', ['-j', jobs], lame); run('/usr/bin/make', ['install'], lame)
const ffmpeg = join(work, 'ffmpeg-8.0.1')
const flags = [
  `--prefix=${prefix}`, '--disable-shared', '--enable-static', '--disable-doc', '--disable-debug', '--disable-autodetect', '--disable-network', '--disable-x86asm', '--disable-everything', '--enable-ffmpeg', '--enable-ffprobe', '--enable-avdevice', '--enable-avfilter', '--enable-swscale', '--enable-swresample', '--enable-libmp3lame', '--enable-zlib',
  `--extra-cflags=-I${prefix}/include`, `--extra-ldflags=-L${prefix}/lib`,
  '--enable-protocol=file,pipe', '--enable-decoder=aac,aac_latm,alac,flac,mp3,mp3float,opus,vorbis,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,png,mjpeg,bmp,webp,wrapped_avframe',
  '--enable-encoder=aac,alac,flac,libmp3lame,pcm_s16le,png,mjpeg', '--enable-parser=aac,aac_latm,flac,mpegaudio,opus,vorbis,png,mjpeg',
  '--enable-demuxer=mov,mp3,flac,wav,ogg,aac,matroska,image2,image2pipe,lavfi', '--enable-muxer=mp3,ipod,mov,flac,wav,ogg,image2,image2pipe,null',
  '--enable-filter=aresample,anull,atrim,asetpts,scale,pad,format,crop,setsar,color,sine,anullsrc', '--enable-indev=lavfi'
]
run('./configure', flags, ffmpeg, { ...process.env, MACOSX_DEPLOYMENT_TARGET: '14.0' })
run('/usr/bin/make', ['-j', jobs], ffmpeg)
for (const name of ['ffmpeg', 'ffprobe']) {
  await copyFile(join(ffmpeg, name), join(root, name)); await chmod(join(root, name), 0o755)
  execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', join(root, name)])
}
await copyFile(join(ffmpeg, 'COPYING.LGPLv2.1'), join(root, 'ffmpeg.LICENSE'))
await copyFile(join(lame, 'COPYING'), join(root, 'lame.LICENSE'))
await copyFile(new URL('./build-ffmpeg.mjs', import.meta.url), join(root, 'build-ffmpeg.mjs'))
await writeFile(join(root, 'ffmpeg-build.json'), JSON.stringify({ version: '8.0.1', recipeSHA256: createHash('sha256').update(await readFile(new URL('./build-ffmpeg.mjs', import.meta.url))).digest('hex'), sources: archives, configure: flags, license: 'LGPL-2.1-or-later', externalLibrary: 'LAME 3.100 (LGPL-2.0-or-later)', sourceChanges: 'None. Build configuration only.' }, null, 2))
await writeFile(join(root, 'ffmpeg.README'), 'TuneVault controlled FFmpeg 8.0.1 build with LAME 3.100. LGPL licenses, unmodified complete source archives, configuration and build recipe are included beside these executables. No nonfree or GPL FFmpeg components are enabled. This distribution includes work by the Independent JPEG Group, used without changes.\n')
console.log('Controlled LGPL FFmpeg/ffprobe build complete')
