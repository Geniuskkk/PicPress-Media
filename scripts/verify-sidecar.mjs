import { execFileSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { basename, join } from 'path'

function listMachODependencies(file) {
  const output = execFileSync('otool', ['-L', file], { encoding: 'utf8' })
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(' (compatibility version')[0].trim())
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

  const libDir = join(binDir, 'lib')
  const copiedLibraries = existsSync(libDir)
    ? readdirSync(libDir)
        .filter((file) => file.endsWith('.dylib'))
        .map((file) => join(libDir, file))
    : []

  assertNoExternalMacLibraries([sidecarPath, ...copiedLibraries])
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