<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';

	let { data, children } = $props();
</script>

<div class="mx-auto max-w-5xl px-4">
	<Navbar customer={data.customer} />
	<main class="py-6">
		{@render children()}
	</main>
</div>
