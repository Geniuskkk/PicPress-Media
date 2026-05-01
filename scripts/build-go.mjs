#!/usr/bin/env node
// scripts/build-go.mjs
// Compile the Go sidecar binary for the current (or specified) platform/arch.
// Usage:
//   node scripts/build-go.mjs                  # native arch
//   node scripts/build-go.mjs --arch arm64      # force arm64
//   node scripts/build-go.mjs --arch x64        # force x64 (amd64)
//
// Output: build/bin/picpress  (macOS/Linux)
//         build/bin/picpress.exe  (Windows)

import { execSync } from 'child_process'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { platform, argv } from 'process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..') // one level up from scripts/
const outDir = join(projectRoot, 'build', 'bin')

mkdirSync(outDir, { recursive: true })

// Parse optional --arch flag
const archIdx = argv.indexOf('--arch')
const targetArch = archIdx !== -1 ? argv[archIdx + 1] : null

const goArchMap = { x64: 'amd64', arm64: 'arm64', ia32: '386' }
const goArch = targetArch ? (goArchMap[targetArch] ?? targetArch) : null

const ext = platform === 'win32' ? '.exe' : ''
const outputName = `picpress${ext}`
const outputPath = join(outDir, outputName)

const archDesc = goArch ?? `native (${process.arch})`
console.log(`\nBuilding Go sidecar [${archDesc}] → ${outputPath}`)

const env = { ...process.env, CGO_ENABLED: '1' }
if (goArch) {
  env.GOARCH = goArch
  // On macOS, ensure GOOS is set when cross-compiling to prevent misdetection.
  if (platform === 'darwin') env.GOOS = 'darwin'
}

try {
  execSync(`go build -o ${outputPath} .`, {
    cwd: projectRoot,
    stdio: 'inherit',
    env,
  })
  console.log('✓ Go sidecar built successfully.\n')
} catch {
  console.error('\n✗ Go build failed. Make sure Go and libvips are installed.\n')
  process.exit(1)
}
