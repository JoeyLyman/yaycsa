<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { logout } from '$lib/api/shop/auth.remote';
	import { Button } from '$lib/components/bits/button';

	let { data, children } = $props();

	const navLinks = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/offers', label: 'Offers' },
		{ href: '/orders', label: 'Orders' },
		{ href: '/account', label: 'Account' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	let loggingOut = $state(false);

	async function handleLogout() {
		loggingOut = true;
		await logout();
		goto('/login');
	}
</script>

<div class="mx-auto max-w-5xl px-4">
	<header class="flex items-center justify-between border-b py-4">
		<div class="flex items-center gap-6">
			<a href="/" class="text-lg font-bold">YAY CSA</a>
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
		</div>
		<div class="flex items-center gap-4">
			<span class="text-muted-foreground text-sm">{data.customer.firstName}</span>
			<Button variant="ghost" size="sm" disabled={loggingOut} onclick={handleLogout}>
				{loggingOut ? 'Logging out...' : 'Log out'}
			</Button>
		</div>
	</header>
	<main class="py-6">
		{@render children()}
	</main>
</div>
