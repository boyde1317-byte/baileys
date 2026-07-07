import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: true,
  clean: true,
  target: 'node20',
  splitting: false,
  sourcemap: false,
  // Do NOT bundle native addons or optional image processors.
  // These are either platform-specific binaries (whatsapp-rust-bridge, libsignal)
  // or optional peer deps (sharp, jimp) that consumers install separately.
  external: [
    'whatsapp-rust-bridge',
    'libsignal',
    'sharp',
    'jimp',
  ],
})
