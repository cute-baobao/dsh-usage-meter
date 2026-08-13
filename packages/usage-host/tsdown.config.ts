import { defineConfig } from 'tsdown'

export default defineConfig({
  name: '@dsh-usage-meter/usage-host',
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
