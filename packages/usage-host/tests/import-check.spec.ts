import UsageMeterService from '../src/index.ts'
import { expect, it } from 'vitest'

it('loads the plugin module', () => {
  expect(typeof UsageMeterService).toBe('function')
})
