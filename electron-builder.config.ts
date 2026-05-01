import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.picpress.media',
  productName: 'PicPress Media',
  copyright: 'Copyright © 2025 PicPress',

  directories: {
    output: 'dist',
    buildResources: 'build',
  },

  // Files included in the asar
  files: [
    'dist-electron/**',
    'dist/renderer/**',
    'node_modules/**',
  ],

  // Unpack ffmpeg/ffprobe from asar so they can be executed as child processes.
  // Electron automatically remaps require() paths to the .asar.unpacked directory.
  asarUnpack: [
    'node_modules/ffmpeg-static/**',
    'node_modules/ffprobe-static/**',
  ],

  // Copy the pre-compiled Go binary into resources/bin/ (outside asar)
  extraResources: [
    {
      from: 'sidecar-bin/',
      to: 'bin/',
    },
  ],

  afterPack: './scripts/verify-sidecar.mjs',

  // ── macOS ─────────────────────────────────────────────────────────────────
  mac: {
    category: 'public.app-category.graphics-design',
    target: [
      { target: 'dmg', arch: ['arm64'] },
      { target: 'zip', arch: ['arm64'] },
    ],
    // hardenedRuntime is required for macOS notarization
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // The bundled Go binary and ffmpeg must be executable; mark them
    // as allowed child-process executables in the entitlements file.
    extendInfo: {
      NSMicrophoneUsageDescription: 'PicPress Media needs microphone access for video processing.',
    },
  },

  dmg: {
    title: 'PicPress Media',
    icon: 'build/icon.icns',
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },

  // ── Windows ───────────────────────────────────────────────────────────────
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },

  // ── Linux ─────────────────────────────────────────────────────────────────
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    category: 'Graphics',
    icon: 'build/icons',
  },
}

export default config
