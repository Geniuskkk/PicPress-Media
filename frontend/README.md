# PicPress renderer

Vue 3 renderer source. Dependencies and lockfile are managed at the repository root.

- `npm run dev:web`: browser preview; run `go run .` separately for the API on port 8080.
- `npm start`: Forge launches Electron, Vite and the Go sidecar.
- `npm run typecheck`: Electron/config and Vue type checks.
- `npm test`: Playwright crop export and navigation regressions.

Tailwind 4 uses `@tailwindcss/vite` and the CSS theme in `src/style.css`.
CropperJS 2 exports the selected pixels as PNG at source resolution; Go performs the final resize and encoding.
