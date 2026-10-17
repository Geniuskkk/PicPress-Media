import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect } from '@playwright/test'

const packageDir = resolve(process.argv[2] ?? `out/PicPress Media-${process.platform}-${process.arch}`)
const executablePath = process.platform === 'darwin'
  ? join(packageDir, 'PicPress Media.app/Contents/MacOS/picpress-media')
  : join(packageDir, `picpress-media${process.platform === 'win32' ? '.exe' : ''}`)
const profile = mkdtempSync(join(tmpdir(), 'picpress-electron-'))
let application
let port
try {
  application = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], timeout: 30000 })
  const page = await application.firstWindow()
  await expect(page.getByRole('heading', { name: '图片处理 & 视频压缩' })).toBeVisible()
  assert.ok(page.url().startsWith('file://'), 'Renderer must load from the packaged files')
  port = await page.evaluate(() => window.electronAPI?.apiPort)
  assert.ok(Number.isInteger(port) && port > 0, 'Preload must expose the sidecar port')
  assert.ok((await fetch(`http://127.0.0.1:${port}/api/health`)).ok)
  const input = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 3840; canvas.height = 2160
    const context = canvas.getContext('2d')
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL().split(',')[1]
  })
  await page.locator('input[accept="image/*"]').setInputFiles({
    name: 'smoke.png', mimeType: 'image/png', buffer: Buffer.from(input, 'base64'),
  })
  await page.getByRole('button', { name: '立即处理', exact: true }).click()
  await expect(page.getByText('处理后:', { exact: false })).toBeVisible()
  assert.ok(await page.evaluate(() => {
    const image = document.querySelector('cropper-image').getBoundingClientRect()
    const canvas = document.querySelector('cropper-canvas').getBoundingClientRect()
    return Math.abs(image.x + image.width / 2 - canvas.x - canvas.width / 2) < 1 &&
      Math.abs(image.y + image.height / 2 - canvas.y - canvas.height / 2) < 1 &&
      image.width <= canvas.width + 1 && image.height <= canvas.height + 1
  }), 'Large images must fit and be centered in the packaged editor')
  await page.getByRole('link', { name: '视频压缩', exact: true }).click()
  await expect(page).toHaveURL(/#\/video/)
  await expect(page.getByText('还没有选择视频', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/#\/video/)
  await expect(page.getByText('还没有选择视频', { exact: true })).toBeVisible()
  if (process.platform === 'darwin') {
    assert.equal(await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.close()
      return window.isVisible()
    }), false, 'Closing the macOS window should hide it')
    assert.equal(await application.evaluate(({ app, BrowserWindow }) => {
      app.emit('activate')
      return BrowserWindow.getAllWindows()[0].isVisible()
    }), true, 'Dock activation should restore the window')
  }
} finally {
  await application?.close()
  rmSync(profile, { recursive: true, force: true })
}
await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) }),
  'Quitting Electron must stop its sidecar')
console.log('Packaged Electron startup, preload, image processing, routing, window lifecycle and sidecar shutdown passed.')
