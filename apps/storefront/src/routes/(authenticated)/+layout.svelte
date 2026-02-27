<script lang="ts">
	import { page } from '$app/state';
	import * as Avatar from '$lib/components/bits/avatar';

	let { data, children } = $props();

	const navLinks = [
		{ href: '/offers', label: 'Offers' },
		{ href: '/orders', label: 'Orders' }
	];

	function isActive(href: string) {
		return page.url.pathname.startsWith(href);
	}

	const initials = $derived(
		(data.customer.firstName?.[0] ?? '') + (data.customer.lastName?.[0] ?? '')
	);
</script>

<div class="mx-auto max-w-5xl px-4">
	<header class="flex items-center justify-between border-b py-4">
		<a
			href="/"
			class="text-lg font-bold transition-colors {page.url.pathname === '/'
				? 'text-foreground'
				: 'text-muted-foreground/60 hover:text-muted-foreground'}"
		>yaycsa</a>
		<div class="flex items-center gap-4">
			<nav class="flex gap-4">
				{#each navLinks as { href, label }}
					<a
						{href}
						class="text-sm transition-colors {isActive(href)
							? 'text-foreground font-medium'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						{label}
					</a>
				{/each}
			</nav>
			<a href="/account" class="ml-2 flex items-center">
				<Avatar.Root
					class={page.url.pathname.startsWith('/account')
						? 'ring-foreground ring-2 ring-offset-2 ring-offset-background'
						: 'hover:ring-muted-foreground hover:ring-2 hover:ring-offset-2 hover:ring-offset-background transition-shadow'}
				>
					<Avatar.Fallback>{initials}</Avatar.Fallback>
				</Avatar.Root>
			</a>
		</div>
	</header>
	<main class="py-6">
		{@render children()}
	</main>
</div>
