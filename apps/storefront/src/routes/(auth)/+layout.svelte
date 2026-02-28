<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<div class="mx-auto w-full max-w-5xl px-4">
		<Navbar />
	</div>
	<div class="flex flex-1 items-center justify-center p-4">
		<div class="w-full max-w-sm">
			{@render children()}
		</div>
	</div>
</div>
