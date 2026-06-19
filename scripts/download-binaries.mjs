/**
 * Downloads yt-dlp and ffmpeg binaries for the current platform.
 * Usage: node scripts/download-binaries.mjs
 *
 * This fetches the latest releases and places them in resources/bin/<platform>/
 */

import { execSync } from 'child_process'
import { mkdirSync, existsSync, chmodSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const platform =
  process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux'

const binDir = join(rootDir, 'resources', 'bin', platform)
mkdirSync(binDir, { recursive: true })

const ext = platform === 'win' ? '.exe' : ''

// yt-dlp URLs
const ytdlpUrls = {
  mac: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  win: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
}

// ffmpeg URLs (using static builds).
// mac: arm64-native (Apple Silicon only). evermeet.cx is x86_64-only and
// trips the macOS "Intel app, won't run on future macOS" warning. ponytail: arm64-only by design.
const ffmpegUrls = {
  mac: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip',
  win: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
  linux:
    'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz'
}

async function downloadYtdlp() {
  const dest = join(binDir, `yt-dlp${ext}`)
  if (existsSync(dest)) {
    console.log('yt-dlp already exists, skipping...')
    return
  }

  console.log(`Downloading yt-dlp for ${platform}...`)
  const url = ytdlpUrls[platform]

  try {
    execSync(`curl -L -o "${dest}" "${url}"`, { stdio: 'inherit' })
    if (platform !== 'win') {
      chmodSync(dest, 0o755)
    }
    console.log('yt-dlp downloaded successfully')
  } catch (err) {
    console.error('Failed to download yt-dlp:', err.message)
    console.log(
      '\nPlease download yt-dlp manually and place it in:',
      dest
    )
  }
}

async function downloadFfmpeg() {
  const ffmpegDest = join(binDir, `ffmpeg${ext}`)
  if (existsSync(ffmpegDest)) {
    console.log('ffmpeg already exists, skipping...')
    return
  }

  console.log(`Downloading ffmpeg for ${platform}...`)
  console.log(
    '\nNote: ffmpeg is a large download. For development, you can also install it via:'
  )

  if (platform === 'mac') {
    console.log('  brew install ffmpeg')
    console.log('  Then symlink: ln -s $(which ffmpeg) ' + ffmpegDest)
    console.log('  Also: ln -s $(which ffprobe) ' + join(binDir, 'ffprobe'))
  } else if (platform === 'linux') {
    console.log('  sudo apt install ffmpeg')
    console.log('  Then symlink: ln -s $(which ffmpeg) ' + ffmpegDest)
    console.log('  Also: ln -s $(which ffprobe) ' + join(binDir, 'ffprobe'))
  } else {
    console.log('  choco install ffmpeg')
    console.log('  Then copy ffmpeg.exe and ffprobe.exe to: ' + binDir)
  }

  console.log('\nAttempting automatic download...')

  try {
    if (platform === 'mac') {
      const zipPath = join(binDir, 'ffmpeg.zip')
      execSync(`curl -L -o "${zipPath}" "${ffmpegUrls.mac}"`, {
        stdio: 'inherit'
      })
      execSync(`unzip -o "${zipPath}" -d "${binDir}"`, { stdio: 'inherit' })
      execSync(`rm "${zipPath}"`, { stdio: 'inherit' })
      chmodSync(ffmpegDest, 0o755)

      // Also get ffprobe (arm64-native to match ffmpeg)
      const ffprobeUrl =
        'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip'
      const probeZip = join(binDir, 'ffprobe.zip')
      execSync(`curl -L -o "${probeZip}" "${ffprobeUrl}"`, { stdio: 'inherit' })
      execSync(`unzip -o "${probeZip}" -d "${binDir}"`, { stdio: 'inherit' })
      execSync(`rm "${probeZip}"`, { stdio: 'inherit' })
      chmodSync(join(binDir, 'ffprobe'), 0o755)
    } else if (platform === 'linux') {
      const tarPath = join(binDir, 'ffmpeg.tar.xz')
      execSync(`curl -L -o "${tarPath}" "${ffmpegUrls.linux}"`, {
        stdio: 'inherit'
      })
      execSync(
        `tar -xf "${tarPath}" --strip-components=2 -C "${binDir}" --wildcards "*/bin/ffmpeg" "*/bin/ffprobe"`,
        { stdio: 'inherit' }
      )
      execSync(`rm "${tarPath}"`, { stdio: 'inherit' })
      chmodSync(ffmpegDest, 0o755)
      chmodSync(join(binDir, 'ffprobe'), 0o755)
    } else {
      const zipPath = join(binDir, 'ffmpeg.zip')
      execSync(`curl -L -o "${zipPath}" "${ffmpegUrls.win}"`, {
        stdio: 'inherit'
      })
      // Extract on Windows (PowerShell)
      execSync(
        `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binDir}' -Force"`,
        { stdio: 'inherit' }
      )
      // Move binaries to the right place and clean up extracted directory
      execSync(
        `powershell -command "Get-ChildItem -Path '${binDir}' -Recurse -Filter 'ffmpeg.exe' | Move-Item -Destination '${ffmpegDest}' -Force"`,
        { stdio: 'inherit' }
      )
      execSync(
        `powershell -command "Get-ChildItem -Path '${binDir}' -Recurse -Filter 'ffprobe.exe' | Move-Item -Destination '${join(binDir, 'ffprobe.exe')}' -Force"`,
        { stdio: 'inherit' }
      )
      // Remove the extracted ffmpeg directory and zip to save ~800MB
      execSync(
        `powershell -command "Get-ChildItem -Path '${binDir}' -Directory -Filter 'ffmpeg-*' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"`,
        { stdio: 'inherit' }
      )
      execSync(
        `powershell -command "Remove-Item -LiteralPath '${zipPath}' -Force -ErrorAction SilentlyContinue"`,
        { stdio: 'inherit' }
      )
    }

    console.log('ffmpeg downloaded successfully')
  } catch (err) {
    console.error('Failed to download ffmpeg:', err.message)
    console.log('\nPlease download ffmpeg manually and place binaries in:', binDir)
  }
}

console.log(`\nDownloading binaries for platform: ${platform}`)
console.log(`Target directory: ${binDir}\n`)

await downloadYtdlp()
await downloadFfmpeg()

console.log('\nDone! Binary status:')
console.log(`  yt-dlp:   ${existsSync(join(binDir, `yt-dlp${ext}`)) ? 'OK' : 'MISSING'}`)
console.log(`  ffmpeg:   ${existsSync(join(binDir, `ffmpeg${ext}`)) ? 'OK' : 'MISSING'}`)
console.log(`  ffprobe:  ${existsSync(join(binDir, `ffprobe${ext}`)) ? 'OK' : 'MISSING'}`)
