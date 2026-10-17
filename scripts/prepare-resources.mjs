import { execFileSync, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { delimiter, join, resolve } from 'node:path'

export function assertNativeTarget(platform, arch) {
  if (platform !== process.platform || arch !== process.arch) {
    throw new Error(`Build ${platform}/${arch} on a matching native runner. Go/libvips and the installed ffmpeg must match the target (host: ${process.platform}/${process.arch}).`)
  }
}

// objdump prints export/unwind tables as well as imports; large DLLs can
// exceed execFileSync's output buffer. Consume lines and retain only DLL names.
export function readWindowsImports(file, command = 'objdump') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['-p', file], { stdio: ['ignore', 'pipe', 'pipe'] })
    const names = new Set()
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
    let diagnostic = ''
    lines.on('line', (line) => {
      const match = /DLL Name:\s*(\S+)/.exec(line)
      if (match) names.add(match[1])
    })
    child.stderr.on('data', (data) => { diagnostic = (diagnostic + data).slice(-8192) })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      lines.close()
      if (code !== 0) reject(new Error(`objdump failed for ${file} (${signal ?? code}): ${diagnostic.trim()}`))
      else resolve([...names])
    })
  })
}

// Resolve MinGW DLLs transitively, excluding Windows system DLLs. objdump is
// installed with the MinGW toolchain used to compile the CGO sidecar.
async function copyWindowsLibraries(binaries, output) {
  const directories = (process.env.PATH ?? '').split(delimiter)
  const seen = new Set()
  const visit = async (file) => {
    for (const name of await readWindowsImports(file)) {
      if (seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      const source = directories.map((dir) => join(dir, name)).find((p) => existsSync(p) && !/[\\/]Windows[\\/]/i.test(p))
      if (!source) {
        const system = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', name)
        if (/^(api-ms-win-|ext-ms-win-)/i.test(name) || existsSync(system)) continue
        throw new Error(`Missing DLL ${name} required by ${file}. Check the UCRT64 PATH.`)
      }
      cpSync(source, join(output, name))
      await visit(source)
    }
  }
  for (const binary of binaries) await visit(binary)
  if (!readdirSync(output).some((name) => /vips.*\.dll$/i.test(name))) {
    throw new Error('libvips DLL was not found on PATH. Add the UCRT64 bin directory before packaging.')
  }
}

// HEIF/AVIF can be a loadable module rather than a direct libvips dependency.
// Keep the versioned module directory so libvips can discover it at runtime.
function copyImageModules(output) {
  const libdir = execFileSync('pkg-config', ['--variable=libdir', 'vips'], { encoding: 'utf8' }).trim()
  const modules = []
  for (const entry of readdirSync(libdir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('vips-modules-')) continue
    const source = join(libdir, entry.name)
    for (const name of readdirSync(source).filter(name => /heif.*\.(dylib|dll)$/.test(name))) {
      const directory = join(output, 'lib', entry.name)
      mkdirSync(directory, { recursive: true })
      const destination = join(directory, name)
      cpSync(join(source, name), destination, { dereference: true })
      modules.push(destination)
    }
  }
  // Some libheif distributions also ship their codecs as loadable modules.
  const heifLibdir = execFileSync('pkg-config', ['--variable=libdir', 'libheif'], { encoding: 'utf8' }).trim()
  const codecs = join(heifLibdir, 'libheif')
  if (existsSync(codecs)) {
    const destination = join(output, 'lib', 'libheif')
    mkdirSync(destination, { recursive: true })
    for (const name of readdirSync(codecs).filter(name => /\.(dylib|dll)$/.test(name))) {
      cpSync(join(codecs, name), join(destination, name), { dereference: true })
      modules.push(join(destination, name))
    }
  }
  return modules
}

export async function prepareResources(platform, arch) {
  assertNativeTarget(platform, arch)
  execFileSync(process.execPath, ['scripts/build-go.mjs', '--arch', arch], { stdio: 'inherit' })
  const output = resolve('.forge-resources/bin')
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
  const name = platform === 'win32' ? 'picpress.exe' : 'picpress'
  const binary = resolve('sidecar-bin', name)
  cpSync(binary, join(output, name))
  const modules = platform === 'linux' ? [] : copyImageModules(output)
  if (platform === 'win32') await copyWindowsLibraries([binary, ...modules], output)
}
