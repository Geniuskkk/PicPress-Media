import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const packageDir = resolve(process.argv[2] ?? `out/PicPress Media-${process.platform}-${process.arch}`)
const resources = process.platform === 'darwin'
  ? join(packageDir, 'PicPress Media.app/Contents/Resources') : join(packageDir, 'resources')
const ext = process.platform === 'win32' ? '.exe' : ''
const sidecar = join(resources, 'bin', `picpress${ext}`)
const modules = join(resources, 'app.asar.unpacked/node_modules')
const ffmpeg = join(modules, 'ffmpeg-static', `ffmpeg${ext}`)
const ffprobe = join(modules, 'ffprobe-static/bin', process.platform, process.arch, `ffprobe${ext}`)
for (const file of [sidecar, ffmpeg, ffprobe]) assert.ok(existsSync(file), `Missing packaged executable: ${file}`)
execFileSync(ffmpeg, ['-version'])
execFileSync(ffprobe, ['-version'])
const reservation = createServer().listen(0, '127.0.0.1')
await once(reservation, 'listening')
const { port } = reservation.address()
await new Promise(resolve => reservation.close(resolve))
const scratch = mkdtempSync(join(tmpdir(), 'picpress-smoke-'))
const child = spawn(sidecar, [], { env: {
  ...process.env, PORT: String(port), FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe,
  ...(process.platform !== 'linux' ? {
    VIPSHOME: join(resources, 'bin'), LIBHEIF_PLUGIN_PATH: join(resources, 'bin/lib/libheif'),
  } : {}),
} })
let logs = ''
child.stdout.on('data', data => { logs += data })
child.stderr.on('data', data => { logs += data })
let spawnError
child.on('error', error => { spawnError = error })
const base = `http://127.0.0.1:${port}`
const run = (args) => execFileSync(ffmpeg, ['-v', 'error', '-y', ...args], { timeout: 30000 })
const probe = (path) => JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', path], { encoding: 'utf8' }))
try {
  let ready = false
  for (let attempt = 0; attempt < 50; attempt++) {
    if (spawnError) throw spawnError
    if (child.exitCode !== null) throw new Error(`Sidecar exited: ${logs}`)
    try { ready = (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })).ok } catch {}
    if (ready) break
    await delay(200)
  }
  assert.ok(ready, `Sidecar failed health check: ${logs}`)
  const input = join(scratch, 'input.png')
  run(['-f', 'lavfi', '-i', 'color=c=red:s=96x64', '-frames:v', '1', input])
  for (const format of ['png', 'jpg', 'webp', 'avif']) {
    const form = new FormData()
    form.set('file', new Blob([readFileSync(input)], { type: 'image/png' }), 'input.png')
    form.set('format', format); form.set('output_width', '48'); form.set('output_height', '32')
    const response = await fetch(`${base}/api/process`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
    assert.equal(response.status, 200, `${format}: ${await response.clone().text()}`)
    const output = join(scratch, `output.${format}`)
    const encoded = Buffer.from(await response.arrayBuffer())
    writeFileSync(output, encoded)
    let decoded = output
    if (format === 'avif') {
      // ffprobe-static's bundled version cannot inspect still AVIF images.
      // Decode with the bundled ffmpeg, then inspect the PNG size.
      assert.equal(encoded.subarray(4, 12).toString(), 'ftypavif')
      decoded = join(scratch, 'decoded-avif.png')
      run(['-i', output, '-frames:v', '1', decoded])
    }
    const stream = probe(decoded).streams[0]
    assert.equal(stream.width, 48); assert.equal(stream.height, 32)
  }
  const video = join(scratch, 'input.mp4')
  run(['-f', 'lavfi', '-i', 'testsrc2=size=96x64:rate=10', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
  for (const format of ['mp4', 'webm']) {
    const form = new FormData()
    form.set('file', new Blob([readFileSync(video)], { type: 'video/mp4' }), 'input.mp4')
    form.set('format', format)
    const response = await fetch(`${base}/api/video/process`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
    assert.equal(response.status, 200, await response.clone().text())
    const output = join(scratch, `output.${format}`)
    writeFileSync(output, Buffer.from(await response.arrayBuffer()))
    assert.equal(probe(output).streams[0].codec_name, format === 'mp4' ? 'h264' : 'vp9')
  }
  console.log('Packaged health, PNG/JPG/WebP/AVIF resize, MP4 and WebM encoding passed.')
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    await exited
    clearTimeout(timer)
  }
  rmSync(scratch, { recursive: true, force: true })
}
