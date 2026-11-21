<script lang="ts">
	import { Navbar } from '#lib/old/components/bundles/navbar/index.ts';
	import { BottomNav } from '#lib/old/components/bundles/bottom-nav/index.ts';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<Navbar />
	<div class="flex flex-1 items-center justify-center px-4 pb-20 md:pb-16">
		<div class="w-full max-w-sm">
			{@render children()}
		</div>
	</div>
	<BottomNav />
</div>
