import { existsSync } from 'fs'
import { join } from 'path'

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
}