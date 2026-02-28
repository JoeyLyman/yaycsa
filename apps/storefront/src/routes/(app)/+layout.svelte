<script lang="ts">
	import { Navbar } from '$lib/components/bundles/navbar';
	import { Footer } from '$lib/components/bundles/footer';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<Navbar customer={data.customer} />
	<main class="mx-auto w-full max-w-5xl px-4 flex-1 py-6">
		{@render children()}
	</main>
	<Footer />
</div>
