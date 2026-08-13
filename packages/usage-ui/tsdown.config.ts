import { defineConfig } from 'tsdown'
import { clientBundle } from '../../tsdown.preset.ts'

export default defineConfig(clientBundle('@dsh-usage-meter/usage-ui', ['lib/types/index.js']))
