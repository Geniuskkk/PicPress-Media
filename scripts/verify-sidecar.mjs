import { execFileSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { basename, dirname, join } from 'path'

function listMachODependencies(file) {
  const output = execFileSync('otool', ['-L', file], { encoding: 'utf8' })
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(' (compatibility version')[0].trim())
}

function listMachORpaths(file) {
  const output = execFileSync('otool', ['-l', file], { encoding: 'utf8' })
  const rpaths = []
  const lines = output.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('cmd LC_RPATH')) continue

    const pathLine = lines.slice(i + 1, i + 4).find((line) => line.trim().startsWith('path '))
    const match = pathLine?.trim().match(/^path (.+) \(offset \d+\)$/)
    if (match) rpaths.push(match[1])
  }

  return rpaths
}

function listDylibs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listDylibs(path)
    if (entry.isFile() && entry.name.endsWith('.dylib')) return [path]
    return []
  })
}

function removeDuplicateRpaths(files) {
  for (const file of files) {
    const counts = new Map()

    for (const rpath of listMachORpaths(file)) {
      const previousCount = counts.get(rpath) ?? 0
      counts.set(rpath, previousCount + 1)

      if (previousCount > 0) {
        execFileSync('install_name_tool', ['-delete_rpath', rpath, file], { stdio: 'inherit' })
      }
    }
  }
}

function signBundledMachOFiles(files) {
  for (const file of files) {
    execFileSync('codesign', ['--force', '--sign', '-', file], { stdio: 'inherit' })
  }
}

function assertValidCodeSignatures(files) {
  const invalid = []

  for (const file of files) {
    try {
      execFileSync('codesign', ['--verify', '--verbose=4', file], { stdio: 'pipe' })
    } catch (error) {
      invalid.push(
        `${file}\n${String(error instanceof Error ? error.message : error)}`
      )
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Bundled macOS sidecar contains invalid code signatures:\n${invalid.join('\n\n')}`)
  }
}

function assertBundledDependenciesExist(files, executableDir) {
  const missing = []

  for (const file of files) {
    for (const dep of listMachODependencies(file)) {
      let resolvedPath = null

      if (dep.startsWith('@loader_path/')) {
        resolvedPath = join(dirname(file), dep.replace('@loader_path/', ''))
      } else if (dep.startsWith('@executable_path/')) {
        resolvedPath = join(executableDir, dep.replace('@executable_path/', ''))
      }

      if (!resolvedPath) continue
      if (!existsSync(resolvedPath)) {
        missing.push(`${file}\n  ${dep} -> ${resolvedPath}`)
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Bundled macOS sidecar has missing bundled dependencies:\n${missing.join('\n\n')}`
    )
  }
}

function assertNoExternalMacLibraries(files) {
  const offenders = []

  for (const file of files) {
    const externalDeps = listMachODependencies(file).filter((dep) => {
      if (dep.startsWith('/System/Library/')) return false
      if (dep.startsWith('/usr/lib/')) return false
      if (dep.startsWith('@executable_path/')) return false
      if (dep.startsWith('@loader_path/')) return false
      return true
    })

    if (externalDeps.length > 0) {
      offenders.push(`${file}\n${externalDeps.map((dep) => `  ${dep}`).join('\n')}`)
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `Bundled macOS sidecar still links to external dynamic libraries:\n${offenders.join('\n\n')}`
    )
  }
}

function bundleMacSidecarLibraries(resourcesDir, sidecarPath) {
  const binDir = join(resourcesDir, 'bin')

  try {
    execFileSync(
      'dylibbundler',
      [
        '-od',
        '-b',
        '-ns',
        '-x',
        basename(sidecarPath),
        '-d',
        'lib',
        '-p',
        '@executable_path/lib/',
      ],
      {
        cwd: binDir,
        stdio: 'inherit',
      }
    )
  } catch (error) {
    throw new Error(
      `Failed to bundle Go sidecar dylibs with dylibbundler. Install it first with \"brew install dylibbundler\".\n\n${String(
        error instanceof Error ? error.message : error
      )}`
    )
  }

  const copiedLibraries = listDylibs(binDir)

  const bundledFiles = [sidecarPath, ...copiedLibraries]
  removeDuplicateRpaths(bundledFiles)
  assertNoExternalMacLibraries(bundledFiles)
  assertBundledDependenciesExist(bundledFiles, binDir)
  signBundledMachOFiles([...copiedLibraries, sidecarPath])
  assertValidCodeSignatures(bundledFiles)
}

export default async function verifySidecar(context) {
  const resourcesDir = context.packager.getResourcesDir(context.appOutDir)
  const candidates = [
    join(resourcesDir, 'bin', 'picpress'),
    join(resourcesDir, 'bin', 'picpress.exe'),
  ]

  if (!candidates.some((file) => existsSync(file))) {
    throw new Error(
      `Bundled Go sidecar not found in packaged resources. Checked:\n${candidates
        .map((file) => `  ${file}`)
        .join('\n')}`
    )
  }

  if (context.electronPlatformName === 'darwin') {
    bundleMacSidecarLibraries(resourcesDir, join(resourcesDir, 'bin', 'picpress'))
  }
}
