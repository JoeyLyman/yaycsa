import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		experimental: {
			remoteFunctions: true
		},
		alias: {
			'@/*': './src/lib/*',
			'@api/*': './src/lib/api',
			'@bits/*': './src/lib/components/bits',
			'@blocks/*': './src/lib/components/blocks',
			'@bundles/*': './src/lib/components/bundles',
			'@layouts/*': './src/lib/components/layouts',
			'@stores/*': './src/lib/stores',
			'@utils/*': './src/lib/utils',
			'@components/*': './src/lib/components'
		}
	},

	compilerOptions: {
		runes: true,
		experimental: {
			async: true
		}
	}
};

export default config;
