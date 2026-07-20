import { app, BrowserWindow, dialog, nativeImage, Menu } from 'electron'
import { join, resolve } from 'path'
import { startSidecar, waitForReady, killSidecar } from './sidecar'

// In dev:  __dirname = <project>/dist-electron/main  → root = ../..
// In prod: __dirname = inside app bundle resources
const projectRoot = app.isPackaged ? process.resourcesPath : resolve(__dirname, '../..')

function getAppIcon(): Electron.NativeImage {
  if (app.isPackaged) {
    if (process.platform === 'win32') return nativeImage.createFromPath(join(projectRoot, 'icon.ico'))
    if (process.platform === 'linux') return nativeImage.createFromPath(join(projectRoot, 'icons', '512x512.png'))
    return nativeImage.createFromPath(join(projectRoot, 'icon.icns'))
  }
  // Dev: use 1024 PNG for all platforms (icns not loaded by Electron outside a bundle)
  return nativeImage.createFromPath(join(projectRoot, 'build', 'icons', '1024x1024.png'))
}

let mainWindow: BrowserWindow | null = null
let apiPort = 0
// Track whether the user triggered a real quit (Cmd+Q / File→Quit).
// On macOS, closing the window should only hide it, not quit the app.
let isQuitting = false

function createWindow(): void {
  // Remove the default application menu on non-macOS platforms
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'PicPress Media',
    icon: getAppIcon(),
    show: false,
    webPreferences: {
      // Pass apiPort as a CLI argument so the preload script can read it
      // synchronously without any IPC round-trip.
      additionalArguments: [`--api-port=${apiPort}`],
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Use native traffic-light buttons on macOS
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
  })

  // Load the frontend
  if (app.isPackaged) {
    mainWindow.loadFile(join(__dirname, '../../dist/renderer/index.html'))
  } else {
    // electron-vite sets ELECTRON_RENDERER_URL in dev mode
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173')
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // ── macOS window-close behaviour ──────────────────────────────────────────
  // Clicking the red ✕ button hides the window instead of quitting the app.
  // The app stays alive in the Dock. Cmd+Q (or File → Quit) sets isQuitting=true
  // first via 'before-quit', so that path actually destroys the window.
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // Set Dock icon before anything else (macOS only, works in dev mode too)
  if (process.platform === 'darwin') {
    const icon = getAppIcon()
    if (!icon.isEmpty()) app.dock.setIcon(icon)
  }

  try {
    apiPort = await startSidecar()
    await waitForReady(apiPort)
  } catch (err) {
    dialog.showErrorBox(
      'PicPress Media — Startup Error',
      String(err instanceof Error ? err.message : err)
    )
    app.quit()
    return
  }

  createWindow()
}

app.whenReady().then(bootstrap)

// ── App lifecycle ─────────────────────────────────────────────────────────────

// macOS: clicking the Dock icon should show the window if it was hidden
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    // Window was never created (shouldn't happen, but defensive)
    createWindow()
  }
})

// Set the flag before any window's 'close' handler fires
app.on('before-quit', () => {
  isQuitting = true
})

// Kill the Go sidecar when Electron is about to exit.
// will-quit is not async-aware, so we preventDefault to keep the app alive
// while killSidecar() runs, then exit explicitly when done.
app.on('will-quit', (event) => {
  event.preventDefault()
  killSidecar()
    .catch((err) => console.error('[sidecar] kill error:', err))
    .finally(() => app.exit(0))
})

// Windows / Linux: quit the app when all windows are closed
// macOS: do NOT quit — keep the app running in the Dock
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
