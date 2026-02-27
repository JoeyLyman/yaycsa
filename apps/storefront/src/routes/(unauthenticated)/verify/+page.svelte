<script lang="ts">
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';

	let { data } = $props();
</script>

{#if data.error}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Verification failed</Card.Title>
			<Card.Description>{data.error}</Card.Description>
		</Card.Header>
		<Card.Footer class="flex-col gap-2">
			<Button href="/register" variant="outline" class="w-full">Register again</Button>
			<Button href="/login" variant="ghost" class="w-full">Back to login</Button>
		</Card.Footer>
	</Card.Root>
{/if}
