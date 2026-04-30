#!/usr/bin/env node
// scripts/build-go.mjs
// Compile the Go sidecar binary for the current platform.
// Output: build/bin/picpress  (macOS/Linux)
//         build/bin/picpress.exe  (Windows)

import { execSync } from 'child_process'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { platform } from 'process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..') // one level up from scripts/
const outDir = join(projectRoot, 'build', 'bin')

mkdirSync(outDir, { recursive: true })

const ext = platform === 'win32' ? '.exe' : ''
const outputName = `picpress${ext}`
const outputPath = join(outDir, outputName)

console.log(`\nBuilding Go sidecar → ${outputPath}`)

try {
  execSync(`go build -o ${outputPath} .`, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      CGO_ENABLED: '1',
    },
  })
  console.log('✓ Go sidecar built successfully.\n')
} catch (err) {
  console.error('\n✗ Go build failed. Make sure Go and libvips are installed.\n')
  process.exit(1)
}
