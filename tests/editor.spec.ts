import { expect, test, type Page } from '@playwright/test'

async function openImage(page: Page, exif = false, size = { width: 800, height: 400 }, drop = false) {
  await page.goto('/')
  const base64 = await page.evaluate(({ exif, size }) => {
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')!
    const w = size.width / 2, h = size.height / 2
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#00ff00'; ctx.fillRect(w, 0, w, h)
    ctx.fillStyle = '#0000ff'; ctx.fillRect(0, h, w, h)
    ctx.fillStyle = '#ffff00'; ctx.fillRect(w, h, w, h)
    return canvas.toDataURL(exif ? 'image/jpeg' : 'image/png', 1).split(',')[1]!
  }, { exif, size })
  let buffer = Buffer.from(base64, 'base64')
  if (exif) {
    // JPEG APP1 / TIFF orientation 6: the browser must rotate 90° clockwise.
    const orientation = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex')
    buffer = Buffer.concat([buffer.subarray(0, 2), orientation, buffer.subarray(2)])
  }
  if (drop) {
    const transfer = await page.evaluateHandle(base64 => {
      const data = new DataTransfer()
      data.items.add(new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], 'large.png', { type: 'image/png' }))
      return data
    }, buffer.toString('base64'))
    await page.getByText('拖拽图片到此处', { exact: true }).dispatchEvent('drop', { dataTransfer: transfer })
    await transfer.dispose()
  } else await page.locator('input[accept="image/*"]').setInputFiles({
    name: exif ? 'portrait.jpg' : 'quadrants.png', mimeType: exif ? 'image/jpeg' : 'image/png', buffer,
  })
  await expect(page.getByRole('button', { name: '立即处理' })).toBeEnabled()
}

async function exportedPixels(page: Page) {
  let upload: Buffer | null = null
  await page.route('**/api/process', async route => {
    const request = route.request()
    const form = await new Response(request.postDataBuffer(), {
      headers: { 'Content-Type': request.headers()['content-type']! },
    }).formData()
    expect(form.has('rotate')).toBe(false)
    expect(form.has('flip_h')).toBe(false)
    expect(form.has('crop_x')).toBe(false)
    upload = Buffer.from(await (form.get('file') as File).arrayBuffer())
    await route.fulfill({ status: 200, contentType: 'image/png', body: upload })
  })
  await page.getByRole('button', { name: '立即处理' }).click()
  await expect(page.getByText('处理后:', { exact: false })).toBeVisible()
  expect(upload).not.toBeNull()
  return page.evaluate(async base64 => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const points = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]
    return { width: image.width, height: image.height,
      colors: points.map(([x, y]) => [...ctx.getImageData(image.width * x!, image.height * y!, 1, 1).data]) }
  }, (upload as unknown as Buffer).toString('base64'))
}

for (const scenario of [
  { name: 'original resolution', buttons: [], width: 800, height: 400, colors: [[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255]] },
  { name: 'clockwise rotation', buttons: ['↻ 顺时针'], width: 400, height: 800, colors: [[0,0,255,255],[255,0,0,255],[255,255,0,255],[0,255,0,255]] },
  { name: 'vertical flip', buttons: ['↕ 垂直'], width: 800, height: 400, colors: [[0,0,255,255],[255,255,0,255],[255,0,0,255],[0,255,0,255]] },
  { name: 'horizontal flip', buttons: ['↔ 水平'], width: 800, height: 400, colors: [[0,255,0,255],[255,0,0,255],[255,255,0,255],[0,0,255,255]] },
  { name: 'rotation then screen horizontal flip', buttons: ['↻ 顺时针','↔ 水平'], width: 400, height: 800, colors: [[255,0,0,255],[0,0,255,255],[0,255,0,255],[255,255,0,255]] },
]) {
  test(`crop export preserves ${scenario.name}`, async ({ page }) => {
    await openImage(page)
    for (const name of scenario.buttons) await page.getByRole('button', { name, exact: true }).click()
    expect(await exportedPixels(page)).toEqual({ width: scenario.width, height: scenario.height, colors: scenario.colors })
  })
}

test('ratio and photo size presets, dark mode and page navigation', async ({ page }) => {
  await openImage(page)
  await page.getByRole('button', { name: '1:1', exact: true }).click()
  const square = await exportedPixels(page)
  expect(square.width).toBe(square.height)
  const sizes = page.locator('select')
  const value = await sizes.locator('option').nth(1).getAttribute('value')
  await sizes.selectOption(value!)
  const dimensions = await page.locator('input[type="number"]').evaluateAll(inputs => inputs.slice(0, 2).map(input => (input as HTMLInputElement).value))
  expect(dimensions.every(value => Number(value) > 0)).toBe(true)
  await page.getByTitle('切换深色').click()
  await expect(page.locator('#app > .dark')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/editor-dark.png', animations: 'disabled' })
  await page.getByRole('link', { name: '视频压缩', exact: true }).click()
  await expect(page).toHaveURL(/#\/video/)
  await page.getByRole('link', { name: '批量处理', exact: true }).click()
  await expect(page).toHaveURL(/#\/batch/)
  await page.getByRole('link', { name: '单图处理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '图片处理 & 视频压缩' })).toBeVisible()
  await page.reload()
  await expect(page.locator('#app > .dark')).toHaveCount(1)
})

async function expectImageFits(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const image = document.querySelector('cropper-image')!.getBoundingClientRect()
    const canvas = document.querySelector('cropper-canvas')!.getBoundingClientRect()
    return {
      centered: Math.abs(image.x + image.width / 2 - canvas.x - canvas.width / 2) < 1 &&
        Math.abs(image.y + image.height / 2 - canvas.y - canvas.height / 2) < 1,
      contained: image.x >= canvas.x - 1 && image.y >= canvas.y - 1 &&
        image.right <= canvas.right + 1 && image.bottom <= canvas.bottom + 1,
      fillsAvailableSpace: Math.min(Math.abs(image.width - canvas.width), Math.abs(image.height - canvas.height)) < 1,
    }
  })).toEqual({ centered: true, contained: true, fillsAvailableSpace: true })
}

test('dropped 4K image fits and stays centered after window resize and rotation', async ({ page }) => {
  await openImage(page, false, { width: 3840, height: 2160 }, true)
  await expectImageFits(page)
  const original = await exportedPixels(page)
  expect([original.width, original.height]).toEqual([3840, 2160])
  await page.screenshot({ path: 'test-results/editor-large-image.png', animations: 'disabled' })
  await page.getByRole('button', { name: '1:1', exact: true }).click()
  const cropped = await exportedPixels(page)
  await page.setViewportSize({ width: 1660, height: 1000 })
  await expectImageFits(page)
  await page.setViewportSize({ width: 1000, height: 650 })
  await expectImageFits(page)
  expect(await exportedPixels(page)).toEqual(cropped)
  await page.getByRole('button', { name: '↻ 顺时针', exact: true }).click()
  await expectImageFits(page)
})

for (const size of [{ width: 2160, height: 3840 }, { width: 160, height: 90 }]) {
  test(`image ${size.width}x${size.height} is fitted and centered`, async ({ page }) => {
    await openImage(page, false, size)
    await expectImageFits(page)
    const output = await exportedPixels(page)
    expect([output.width, output.height]).toEqual([size.width, size.height])
  })
}


test('EXIF orientation preserves portrait dimensions and pixel orientation', async ({ page }) => {
  await openImage(page, true)
  const result = await exportedPixels(page)
  expect([result.width, result.height]).toEqual([400, 800])
  const expected = [[0,0,255,255],[255,0,0,255],[255,255,0,255],[0,255,0,255]]
  result.colors.forEach((color, i) => color.forEach((channel, j) => {
    expect(Math.abs(channel - expected[i]![j]!)).toBeLessThanOrEqual(3)
  }))
})
