# PicPress Media v2.2.0

## What's changed

- Redesigned the app icon with a warm white tile, graphite crop frame, and vermilion play mark. Unified macOS, Windows, Linux, and frontend assets; corrected macOS runtime icon loading and added Windows icon sizes for multiple DPI scales.
- Upgraded to CropperJS 2 with source-resolution crop export and improved large-image centering, rotation, flipping, and crop preservation when resizing the window.
- Confirming custom width and height now updates the crop selection. Fixed resize handles being difficult to drag at canvas edges.
- Removed unnecessary vertical page scrolling. Thanks to @1257992879 for the contribution ([#2](https://github.com/Geniuskkk/PicPress-Media/pull/2)).
- Migrated to Electron Forge 8, updated Electron, Vue, and build dependencies, and consolidated dependencies at the repository root.
- Improved HEIF/AVIF plugin and native dependency packaging. Fixed Windows DLL scanning, Linux Maker configuration, and Fedora RPM staging paths.

## Downloads and installation

- **macOS (Apple Silicon arm64)**: DMG and ZIP. Intel Macs require a separate build on Intel hardware.
- **Windows (x64)**: Squirrel `Setup.exe`. Uninstall an older NSIS installation first.
- **Linux (x64)**: DEB and RPM, with runtime dependencies installed by the system package manager.

All image and video processing runs locally. ffmpeg is bundled with the app.

**Full changelog:** [v2.1.0 → v2.2.0](https://github.com/Geniuskkk/PicPress-Media/compare/v2.1.0...v2.2.0)
