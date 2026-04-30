// Type declarations for the contextBridge API exposed by electron/preload/index.ts

interface ElectronAPI {
  /** The port the Go sidecar is listening on */
  readonly apiPort: number
}

declare interface Window {
  readonly electronAPI?: ElectronAPI
}
