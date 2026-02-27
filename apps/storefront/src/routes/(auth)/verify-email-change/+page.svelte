<script lang="ts">
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';

	let { data } = $props();
</script>

{#if data.success}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Email updated</Card.Title>
			<Card.Description>Your email address has been changed successfully.</Card.Description>
		</Card.Header>
		<Card.Footer>
			<Button href="/me/account" class="w-full">Go to account</Button>
		</Card.Footer>
	</Card.Root>
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Verification failed</Card.Title>
			<Card.Description>{data.error}</Card.Description>
		</Card.Header>
		<Card.Footer>
			<Button href="/me/account" variant="outline" class="w-full">Go to account</Button>
		</Card.Footer>
	</Card.Root>
{/if}
