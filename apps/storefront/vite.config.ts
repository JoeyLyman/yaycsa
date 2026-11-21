import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			compilerOptions: { runes: true, experimental: { async: true } },
			adapter: adapter(),
			experimental: { remoteFunctions: true },
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
		})
	],
	ssr: { noExternal: ['@lucide/svelte'] }
});
