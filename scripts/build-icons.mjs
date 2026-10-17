// Run with ImageMagick installed. Generated assets are committed for packaging.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = join(root, 'build/icon-source.png')
const output = join(root, 'build/icons')
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256, 512, 1024]
mkdirSync(output, { recursive: true })
for (const size of sizes) {
  execFileSync('magick', [source, '-resize', `${size}x${size}`, join(output, `${size}x${size}.png`)])
}
execFileSync('magick', [
  ...sizes.filter(size => size <= 256).map(size => join(output, `${size}x${size}.png`)),
  join(root, 'build/icon.ico'),
])
// ICNS stores PNG representations in typed, length-prefixed chunks.
const representations = [['icp4', 16], ['icp5', 32], ['icp6', 64],
  ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]]
const chunks = representations.map(([type, size]) => {
  const png = readFileSync(join(output, `${size}x${size}.png`))
  const header = Buffer.alloc(8)
  header.write(type)
  header.writeUInt32BE(png.length + 8, 4)
  return Buffer.concat([header, png])
})
const header = Buffer.alloc(8)
header.write('icns')
header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4)
writeFileSync(join(root, 'build/icon.icns'), Buffer.concat([header, ...chunks]))
copyFileSync(join(output, '1024x1024.png'), join(root, 'frontend/src/assets/icon.png'))
console.log('Generated ICNS, multi-resolution ICO, PNGs and frontend icon.')
