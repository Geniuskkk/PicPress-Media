import { contextBridge } from 'electron'

// Read the API port injected by the main process via additionalArguments.
// This is synchronous and available before any renderer code runs.
const portArg = process.argv.find((a) => a.startsWith('--api-port='))
const apiPort = portArg ? parseInt(portArg.split('=')[1], 10) : 8080

contextBridge.exposeInMainWorld('electronAPI', {
  /** Port the Go sidecar is listening on (e.g. 52341) */
  apiPort,
})
