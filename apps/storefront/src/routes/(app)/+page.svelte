<script lang="ts">
	let { data } = $props();

	const farms = [
		{ slug: 'gathering-together-farm', name: 'Gathering Together Farm', location: 'Philomath, OR' },
		{ slug: 'winter-green-farm', name: 'Winter Green Farm', location: 'Noti, OR' },
		{ slug: 'deep-roots-farm', name: 'Deep Roots Farm', location: 'Corvallis, OR' },
		{ slug: 'oak-prairie-farm', name: 'Oak Prairie Farm', location: 'Junction City, OR' },
		{ slug: 'creek-bottom-produce', name: 'Creek Bottom Produce', location: 'Salem, OR' }
	];
</script>

{#if data.customer}
	<h1 class="text-2xl font-bold">Welcome, {data.customer.firstName}</h1>
{:else}
	<h1 class="text-2xl font-bold">Local farms &amp; producers</h1>
{/if}
<p class="text-muted-foreground mt-2">Browse offers from local farms and producers.</p>

<div class="mt-6 space-y-2">
	{#each farms as farm (farm.slug)}
		<a
			href="/{farm.slug}"
			class="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent"
		>
			<span class="font-medium">{farm.name}</span>
			<span class="text-muted-foreground text-sm">{farm.location}</span>
		</a>
	{/each}
</div>
