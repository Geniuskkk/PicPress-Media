import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { resolve, join } from 'node:path'
import { prepareResources } from './scripts/prepare-resources.mjs'
import verifySidecar from './scripts/verify-sidecar.mjs'

const config: ForgeConfig = {
  packagerConfig: {
    name: 'PicPress Media',
    executableName: 'picpress-media',
    appBundleId: 'com.picpress.media',
    appCategoryType: 'public.app-category.graphics-design',
    icon: resolve('build/icon'),
    // Vite bundles the renderer but the main process keeps these npm packages
    // external. Include node_modules, then let Packager prune devDependencies.
    ignore: (path) => !!path && !/^\/(?:\.vite(?:\/|$)|node_modules(?:\/|$)|package\.json$|LICENSE$)/.test(path),
    asar: { unpackDir: 'node_modules/{ffmpeg-static,ffprobe-static}' },
    extraResource: [resolve('.forge-resources/bin'), resolve('build/icon.icns'), resolve('build/icon.ico'), resolve('build/icons')],
    // Runs after resources are copied and BEFORE Packager signs the app.
    afterCopyExtraResources: [async ({ buildPath, platform }) => {
      const resources = platform === 'darwin'
        ? join(buildPath, 'PicPress Media.app', 'Contents', 'Resources')
        : join(buildPath, 'resources')
      await verifySidecar(resources, platform)
    }],
    ...(process.env.APPLE_SIGNING_IDENTITY ? {
      osxSign: {
        identity: process.env.APPLE_SIGNING_IDENTITY,
        optionsForFile: () => ({ entitlements: resolve('build/entitlements.mac.plist'), hardenedRuntime: true }),
      },
    } : {}),
  },
  hooks: {
    generateAssets: async (_config, platform, arch) => prepareResources(platform, arch),
  },
  makers: [
    new MakerDMG({ icon: resolve('build/icon.icns') }),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({ name: 'picpress_media', setupIcon: resolve('build/icon.ico') }),
    new MakerDeb({ options: {
      bin: 'picpress-media', icon: resolve('build/icons/512x512.png'), categories: ['Graphics'],
      depends: ['libvips42', 'libgtk-3-0', 'libnss3', 'libasound2', 'libgbm1', 'libxss1', 'libxtst6', 'xdg-utils'],
    } }),
    new MakerRpm({ options: {
      // Supported by electron-installer-redhat; not yet declared in Forge's types.
      ...{ specTemplate: resolve('build/rpm.spec.ejs') },
      bin: 'picpress-media', icon: resolve('build/icons/512x512.png'), categories: ['Graphics'],
      requires: ['vips', 'vips-heif', 'gtk3', 'nss', 'alsa-lib', 'mesa-libgbm', 'libXScrnSaver', 'libXtst', 'xdg-utils'],
    } }),
  ],
  plugins: [new VitePlugin({
    build: [
      { entry: 'electron/main/index.ts', config: 'vite.main.config.ts', target: 'main' },
      { entry: 'electron/preload/index.ts', config: 'vite.preload.config.ts', target: 'preload' },
    ],
    renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
  })],
}

export default config
