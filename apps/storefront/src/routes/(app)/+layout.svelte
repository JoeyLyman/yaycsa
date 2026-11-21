<script lang="ts">
	import { Navbar } from '#lib/components/bundles/navbar/index.ts';
	import { BottomNav } from '#lib/components/bundles/bottom-nav/index.ts';
	import { Footer } from '#lib/components/bundles/footer/index.ts';

	let {
		data,
		children
	}: {
		data: {
			customer?: any;
		};
		children: import('svelte').Snippet;
	} = $props();
</script>

<div class="flex min-h-screen flex-col">
	<Navbar customer={data.customer} />
	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20 md:pb-6">
		{@render children()}
	</main>
	<Footer />
	<BottomNav customer={data.customer} />
</div>
