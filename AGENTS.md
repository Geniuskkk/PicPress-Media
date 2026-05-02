# AGENTS.md

This file provides guidance to ai when working with code in this repository.

## Architecture

PicPress Media is a cross-platform desktop app built as **Electron + Vue 3 frontend + Go sidecar**. All media processing happens locally via the Go sidecar; nothing is uploaded to external services.

```
Electron main process (electron/main/)
  ├── Spawns Go sidecar on a random 127.0.0.1 port
  ├── Injects FFMPEG_PATH / FFPROBE_PATH env vars into the Go process
  ├── Passes the port number to the renderer via additionalArguments → preload → contextBridge
  └── Opens BrowserWindow loading the Vue 3 frontend

Go sidecar (main.go, internal/)
  ├── chi router with CORS, logging, recovery, gzip middleware
  ├── /api/health            — health check
  ├── /api/process           — single image processing (bimg/libvips)
  ├── /api/batch             — batch image processing → streaming ZIP
  └── /api/video/process     — video compression via bundled ffmpeg

Vue 3 frontend (frontend/)
  ├── Hash-based routing (required for file:// in packaged Electron)
  ├── Pinia store (imageStore.ts) holds current file, batch files, preset
  ├── TailwindCSS + dark mode persisted in localStorage
  └── API calls use window.electronAPI.apiPort (Electron) or '' (browser dev via Vite proxy)
```

### Image processing pipeline (Go)

The `processor.Process` function applies operations in fixed order:
1. **Crop** — uses bimg extract area, disables auto-rotate during crop
2. **Rotate** — normalizes angle to 0/90/180/270
3. **Flip** — horizontal (flop) then vertical (flip)
4. **Resize** — only if output dimensions specified; uses `Force` when both W/H given
5. **Format + Quality conversion** — via bimg type conversion
6. **MaxSizeKB iteration** — if target size is set, re-encodes from the post-resize buffer with decreasing quality (steps of 5, minimum quality 10)

### Video processing pipeline (Go)

- Writes uploaded file to a temp dir, runs ffmpeg, reads output back
- When `max_size_mb > 0`: probes video duration with ffprobe, calculates target bitrate (`(MB * 8192) / duration_seconds`), uses `-b:v` with VBV bufsize for MP4
- When no size target: uses CRF encoding (quality slider maps to CRF 40 down to ~18)
- MP4: H.264 (libx264) + AAC, WebM: VP9 (libvpx-vp9) + Opus

## Commands

```bash
# Install (libvips must be installed first: brew install vips)
npm install --legacy-peer-deps

# Compile Go sidecar → sidecar-bin/picpress
npm run build:go              # native arch
npm run build:go:arm64        # force arm64
npm run build:go:x64          # force amd64

# Development (starts Electron + Vite HMR for renderer)
npm run dev

# Build Electron + Vue (no Go compilation)
npm run build

# Package for current platform (compiles Go + builds Electron + runs electron-builder)
npm run dist
npm run dist:mac              # macOS DMG + ZIP (arm64)
npm run dist:win              # Windows NSIS (x64)
npm run dist:linux            # Linux AppImage + deb (x64)
```

## Project layout

| Directory | Purpose |
|-----------|---------|
| `electron/main/` | Electron main process: window creation, sidecar lifecycle |
| `electron/preload/` | contextBridge — exposes `apiPort` to renderer |
| `frontend/src/` | Vue 3 app: views (Home, Editor, Batch, Video), stores, utils |
| `internal/handler/` | Go HTTP handlers (parse form, validate, delegate to processor) |
| `internal/processor/` | Go image/video processing logic (bimg + ffmpeg) |
| `scripts/` | `build-go.mjs` (compile Go binary), `verify-sidecar.mjs` (electron-builder afterPack hook) |
| `build/` | App icons and macOS entitlements plist |
| `sidecar-bin/` | Compiled Go binary output (gitignored) |

## Key details

- **macOS window behavior**: clicking red ✕ hides the window (app stays in Dock); `Cmd+Q` quits. `window-all-closed` does NOT quit on macOS. The `before-quit` event sets `isQuitting = true` so the close handler knows this is a real quit.
- **Hash routing**: `createWebHashHistory()` is required because the packaged app loads `file://.../index.html` where HTML5 history mode would break.
- **API base URL**: in Electron, the preload script reads `--api-port=N` from `process.argv` and exposes it via `contextBridge`. The `api.ts` utility checks `window.electronAPI?.apiPort` and falls back to `''` (Vite dev-server proxy) when running in a browser.
- **ffmpeg/ffprobe resolution**: in development, uses the `ffmpeg-static` / `ffprobe-static` npm packages. In production, the Go sidecar reads `FFMPEG_PATH` / `FFPROBE_PATH` env vars set by Electron's `startSidecar()`.
- **CGO required**: the Go sidecar depends on `bimg` (C bindings to libvips), so cross-compilation is not supported. macOS and Windows builds must happen on their respective OS.
- **macOS packaging**: the `verify-sidecar.mjs` afterPack hook uses `dylibbundler` to bundle libvips `.dylib` files into the app bundle, then verifies no external dylib references remain.
- **CI**: GitHub Actions workflow in `.github/workflows/release.yml` triggers on `v*.*.*` tags, builds on macos-14 (arm64), windows-latest, ubuntu-22.04 in parallel, then creates a GitHub Release with all artifacts.
