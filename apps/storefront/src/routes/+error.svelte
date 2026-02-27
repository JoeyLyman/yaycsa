<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/bits/button';
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm text-center">
		<h1 class="text-2xl font-bold">Something went wrong</h1>
		<p class="text-muted-foreground mt-2">{page.error?.message ?? 'An unexpected error occurred'}</p>
		<Button class="mt-4" onclick={() => invalidateAll()}>Try again</Button>
	</div>
</div>
