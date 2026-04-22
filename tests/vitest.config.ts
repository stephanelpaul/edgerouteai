import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
	},
	resolve: {
		alias: {
			'@edgerouteai/shared/models': resolve(root, 'packages/shared/src/models'),
			'@edgerouteai/shared/pricing': resolve(root, 'packages/shared/src/pricing'),
			'@edgerouteai/shared/errors': resolve(root, 'packages/shared/src/errors'),
			'@edgerouteai/shared': resolve(root, 'packages/shared/src'),
			'@edgerouteai/core': resolve(root, 'packages/core/src'),
			'@edgerouteai/db': resolve(root, 'packages/db/src'),
		},
	},
})
