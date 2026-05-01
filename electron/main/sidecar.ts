import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { createServer } from 'net'
import { existsSync, chmodSync } from 'fs'

let sidecarProcess: ChildProcess | null = null
let sidecarStartupError: Error | null = null
let sidecarStderr = ''

function rememberSidecarStderr(data: Buffer): void {
  sidecarStderr = `${sidecarStderr}${data.toString()}`.slice(-4000)
}

function buildSidecarError(message: string): Error {
  const stderr = sidecarStderr.trim()
  if (!stderr) return new Error(message)
  return new Error(`${message}\n\nLast sidecar stderr:\n${stderr}`)
}

/** Find a free TCP port on 127.0.0.1 */
function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get port'))
        return
      }
      const port = addr.port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

/** Absolute path to the Go sidecar binary */
function getBinaryPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const name = `picpress${ext}`

  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', name)
  }
  // Dev: binary lives in <project-root>/sidecar-bin/
  return join(app.getAppPath(), 'sidecar-bin', name)
}

/** Absolute path to the bundled ffmpeg binary */
function getFfmpegPath(): string {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    return join(process.resourcesPath, 'ffmpeg', `ffmpeg${ext}`)
  }
  // Dev: use ffmpeg-static from node_modules
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('ffmpeg-static') as string | null
  if (!p) throw new Error('ffmpeg-static returned null')
  return p
}

/** Absolute path to the bundled ffprobe binary */
function getFfprobePath(): string {
  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    return join(process.resourcesPath, 'ffmpeg', `ffprobe${ext}`)
  }
  // Dev: use ffprobe-static from node_modules
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = (require('ffprobe-static') as { path: string }).path
  if (!p) throw new Error('ffprobe-static returned null')
  return p
}

/**
 * Start the Go sidecar process.
 * Returns the port it is listening on.
 */
export async function startSidecar(): Promise<number> {
  const port = await getAvailablePort()
  const binaryPath = getBinaryPath()
  sidecarStartupError = null
  sidecarStderr = ''

  if (!existsSync(binaryPath)) {
    throw new Error(
      `Go binary not found at:\n  ${binaryPath}\n\nRun "npm run build:go" to compile it first.`
    )
  }

  // Ensure the binary is executable on Unix-like systems
  if (process.platform !== 'win32') {
    try {
      chmodSync(binaryPath, 0o755)
    } catch {
      // Non-fatal: may already be executable
    }
  }

  const ffmpegPath = getFfmpegPath()
  const ffprobePath = getFfprobePath()

  sidecarProcess = spawn(binaryPath, [], {
    env: {
      ...process.env,
      PORT: String(port),
      FFMPEG_PATH: ffmpegPath,
      FFPROBE_PATH: ffprobePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  sidecarProcess.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[sidecar] ${data}`)
  })
  sidecarProcess.stderr?.on('data', (data: Buffer) => {
    rememberSidecarStderr(data)
    process.stderr.write(`[sidecar] ${data}`)
  })
  sidecarProcess.on('error', (error) => {
    sidecarStartupError = buildSidecarError(`Failed to start Go sidecar: ${error.message}`)
  })
  sidecarProcess.on('exit', (code, signal) => {
    console.log(`[sidecar] exited — code=${code} signal=${signal}`)
    if (code !== 0 || signal !== null) {
      sidecarStartupError = buildSidecarError(
        `Go sidecar exited before becoming ready (code=${code} signal=${signal})`
      )
    }
    sidecarProcess = null
  })

  return port
}

/**
 * Poll /api/health until the Go server is ready or timeout is reached.
 */
export async function waitForReady(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (sidecarStartupError) {
      throw sidecarStartupError
    }

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (res.ok) return
    } catch {
      // Server not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  if (sidecarStartupError) {
    throw sidecarStartupError
  }

  throw buildSidecarError(`Go sidecar did not become ready within ${timeoutMs / 1000}s`)
}

/** Gracefully terminate the Go sidecar process. */
export function killSidecar(): void {
  if (sidecarProcess && !sidecarProcess.killed) {
    sidecarProcess.kill('SIGTERM')
    sidecarProcess = null
  }
}
