import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
	},
	resolve: {
		alias: {
			'@edgerouteai/shared/models':
				'/Users/stephanelpaul/Projects/edgerouteai/packages/shared/src/models',
			'@edgerouteai/shared/pricing':
				'/Users/stephanelpaul/Projects/edgerouteai/packages/shared/src/pricing',
			'@edgerouteai/shared/errors':
				'/Users/stephanelpaul/Projects/edgerouteai/packages/shared/src/errors',
			'@edgerouteai/shared': '/Users/stephanelpaul/Projects/edgerouteai/packages/shared/src',
			'@edgerouteai/core': '/Users/stephanelpaul/Projects/edgerouteai/packages/core/src',
			'@edgerouteai/db': '/Users/stephanelpaul/Projects/edgerouteai/packages/db/src',
		},
	},
})
