import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		coverage: {
			provider: 'v8',
			reports: ['text', 'lcov'],
			exclude: [
				'dist/**',
				'node_modules/**',
				'**/*.config.*',
				'**/vitest.config.ts',
				'**/*.test.ts',
				'**/*.types.ts',
				'**/types/**',
			],
		},
	},
});
