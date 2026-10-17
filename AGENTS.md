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

The Go API applies EXIF auto-orientation → rotate → flip → crop → resize → format/quality conversion → target-size iteration.
The Editor uses CropperJS 2 to export its selection at source resolution as lossless PNG, including rotation and flip. It sends no crop/transform parameters to Go, which only resizes and encodes this result. Direct API clients can still use the Go crop/transform pipeline.

### Video processing pipeline (Go)

- Writes uploaded file to a temp dir, runs ffmpeg, reads output back
- When `max_size_mb > 0`: probes video duration with ffprobe, calculates target bitrate (`(MB * 8192) / duration_seconds`), uses `-b:v` with VBV bufsize for MP4
- When no size target: uses CRF encoding (quality slider maps to CRF 40 down to ~18)
- MP4: H.264 (libx264) + AAC, WebM: VP9 (libvpx-vp9) + Opus

## Commands

```bash
# Node 24 LTS (>=24.20), Go 1.27.2, libvips required
npm ci
npm start                    # Forge: compile Go + start Electron/Vite
npm run typecheck            # Electron/config and Vue types
npm run build:web            # standalone renderer build
npm run build:go             # optional standalone Go compilation
npm run package              # Forge application directory in out/
npm run make                 # Forge installers in out/make/
npm run dist:mac             # macOS arm64 DMG + ZIP (on arm64 Mac)
npm run dist:mac:x64          # macOS x64 (on Intel Mac)
npm run dist:win             # Windows x64 Squirrel
npm run dist:linux           # Linux x64 DEB/RPM, use --targets for one maker
npx playwright install chromium
npm test                     # browser crop pixel regression tests
npm run smoke:package        # packaged health/image/MP4/WebM smoke test
npm run smoke:electron       # packaged desktop UI/lifecycle test (requires display)
```

## Project layout

| Directory | Purpose |
|-----------|---------|
| `electron/main/` | Electron main process: window creation, sidecar lifecycle |
| `electron/preload/` | contextBridge — exposes `apiPort` to renderer |
| `frontend/src/` | Vue 3 app: views (Home, Editor, Batch, Video), stores, utils |
| `internal/handler/` | Go HTTP handlers (parse form, validate, delegate to processor) |
| `internal/processor/` | Go image/video processing logic (bimg + ffmpeg) |
| `scripts/` | `build-go.mjs` (compile Go binary), `prepare-resources.mjs` and `verify-sidecar.mjs` (Forge resource hooks) |
| `build/` | App icons and macOS entitlements plist |
| `sidecar-bin/` | Compiled Go binary output (gitignored) |

## Key details

- **macOS window behavior**: clicking red ✕ hides the window (app stays in Dock); `Cmd+Q` quits. `window-all-closed` does NOT quit on macOS. The `before-quit` event sets `isQuitting = true` so the close handler knows this is a real quit.
- **Hash routing**: `createWebHashHistory()` is required because the packaged app loads `file://.../index.html` where HTML5 history mode would break.
- **API base URL**: in Electron, the preload script reads `--api-port=N` from `process.argv` and exposes it via `contextBridge`. The `api.ts` utility checks `window.electronAPI?.apiPort` and falls back to `''` (Vite dev-server proxy) when running in a browser.
- **ffmpeg/ffprobe resolution**: in development, uses the `ffmpeg-static` / `ffprobe-static` npm packages. In production, the Go sidecar reads `FFMPEG_PATH` / `FFPROBE_PATH` env vars set by Electron's `startSidecar()`.
- **CGO required**: the Go sidecar depends on `bimg` (C bindings to libvips), so cross-compilation is not supported. macOS and Windows builds must happen on their respective OS.
- **Forge**: `forge.config.ts` configures Vite main/preload/renderer builds. Main/preload output is CommonJS (`.vite/build/main.cjs`, `preload.cjs`); config files are ESM. All dependencies and the lockfile live at the root.
- **macOS packaging**: the `verify-sidecar.mjs` Packager `afterCopyExtraResources` hook (before final app signing) uses `dylibbundler` to bundle libvips `.dylib` files into the app bundle, then verifies no external dylib references remain.
- **HEIF/AVIF**: `prepare-resources.mjs` also collects loadable HEIF modules and codec dependencies on macOS/Windows. Packaged sidecars set `VIPSHOME` and `LIBHEIF_PLUGIN_PATH` to bundled locations. Fedora requires `vips-heif`; Windows builds need MinGW `libheif` explicitly.
- **Cropper geometry**: keep `selection.precise = true` to preserve source pixels; programmatic centering temporarily enables `image.translatable` because `$center()` uses `$move()`. A ResizeObserver refits the preview while preserving the source crop and export dimensions.
- **CI**: GitHub Actions workflow in `.github/workflows/release.yml` triggers on `v*.*.*` tags, builds on macos-14 (arm64), windows-latest, ubuntu-22.04 (DEB), and Fedora 44 (RPM), then creates a GitHub Release with all artifacts.

- **Upgrade constraint**: TypeScript is pinned to 6.0.3 because vue-tsc 3.3.13 cannot load the TypeScript 7 compiler internals. Do not bypass this failure with skipLibCheck or legacy-peer-deps.
- **Batch UI**: calls the single-image API sequentially and creates ZIPs with JSZip; `/api/batch` is a separate server-side API.
