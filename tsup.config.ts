import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  dts: false,
  clean: true,
  target: 'node20',
  splitting: false,
  sourcemap: false,
})
