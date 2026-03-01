<script lang="ts">
	import { page, navigating } from '$app/state';
	import * as Avatar from '$lib/components/bits/avatar';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';

	type Props = {
		customer?: { firstName: string; lastName: string } | null;
	};

	let { customer = null }: Props = $props();

	// Use navigating target for instant feedback, fall back to current page
	const currentPathname = $derived(navigating.to?.url.pathname ?? page.url.pathname);

	// --- Brand derivation from URL ---
	const reservedPaths = new Set([
		'me',
		'login',
		'register',
		'forgot-password',
		'reset-password',
		'verify',
		'verify-email-change'
	]);
	const pathSegments = $derived(currentPathname.split('/').filter(Boolean));
	const isMe = $derived(pathSegments[0] === 'me');
	const isSellerPage = $derived(
		pathSegments.length >= 1 && !reservedPaths.has(pathSegments[0])
	);
	const isHome = $derived(currentPathname === '/');

	const brandSuffix = $derived(isMe ? 'me' : isSellerPage ? pathSegments[0] : 'csa');
	const suffixHref = $derived(isMe ? '/me' : isSellerPage ? `/${pathSegments[0]}` : '/');

	const isBrandActive = $derived(
		isHome || (isSellerPage && pathSegments.length === 1) || currentPathname === '/me'
	);

	// --- Nav links (authenticated) ---
	const navLinks = [
		{ href: '/me/offers', label: 'Offers' },
		{ href: '/me/orders', label: 'Orders' }
	];

	function isNavActive(href: string) {
		return currentPathname.startsWith(href);
	}

	// --- Auth link active state ---
	const isLoginActive = $derived(currentPathname === '/login');
	const isRegisterActive = $derived(currentPathname === '/register');

	// --- User initials ---
	const initials = $derived(
		customer ? (customer.firstName?.[0] ?? '') + (customer.lastName?.[0] ?? '') : ''
	);
</script>

<header class="border-b">
	<div class="mx-auto max-w-5xl px-4 flex items-center justify-between py-4">
		<div class="flex items-center">
			{#if brandSuffix === 'csa'}
				<a
					href="/"
					class="text-lg font-bold transition-colors {isBrandActive
						? 'text-foreground cursor-default'
						: 'text-muted-foreground/60 hover:text-muted-foreground'}"
				>yay<span class="mx-0.5">&middot;</span>csa</a>
			{:else}
				<a
					href="/"
					class="text-lg font-bold transition-colors {isHome
						? 'text-foreground cursor-default'
						: 'text-muted-foreground/60 hover:text-muted-foreground'}"
				>yay</a><a
					href={suffixHref}
					class="text-lg font-bold transition-colors truncate max-w-48 sm:max-w-72 {isBrandActive
						? 'text-foreground cursor-default'
						: 'text-muted-foreground/60 hover:text-muted-foreground'}"
				><span class="mx-0.5">&middot;</span>{brandSuffix}</a>
			{/if}
		</div>
		<div class="flex items-center gap-4">
			{#if customer}
				<nav class="flex items-center gap-4">
					<a
						href="/me/cart"
						class="transition-colors {currentPathname.startsWith('/me/cart')
							? 'text-foreground cursor-default'
							: isBrandActive
								? 'text-muted-foreground/60 hover:text-muted-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
					>
						<ShoppingCart class="h-4 w-4" />
					</a>
					<span class="text-border">|</span>
					{#each navLinks as { href, label } (href)}
						<a
							{href}
							class="text-sm transition-colors {isNavActive(href) && !isBrandActive
								? 'text-foreground font-medium cursor-default'
								: isBrandActive
									? 'text-muted-foreground/60 hover:text-muted-foreground'
									: 'text-muted-foreground hover:text-foreground'}"
						>
							{label}
						</a>
					{/each}
				</nav>
				<a href="/me/account" class="ml-2 flex items-center {currentPathname.startsWith('/me/account') ? 'cursor-default' : ''}">
					<Avatar.Root
						class={currentPathname.startsWith('/me/account')
							? 'ring-foreground ring-2 ring-offset-2 ring-offset-background'
							: 'hover:ring-muted-foreground hover:ring-2 hover:ring-offset-2 hover:ring-offset-background transition-shadow'}
					>
						<Avatar.Fallback>{initials}</Avatar.Fallback>
					</Avatar.Root>
				</a>
			{:else}
				<nav class="flex gap-4">
					<a
						href="/login"
						class="text-sm transition-colors {isLoginActive
							? 'text-foreground font-medium cursor-default'
							: isBrandActive
								? 'text-muted-foreground/60 hover:text-muted-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
					>Log in</a>
					<a
						href="/register"
						class="text-sm transition-colors {isRegisterActive
							? 'text-foreground font-medium cursor-default'
							: isBrandActive
								? 'text-muted-foreground/60 hover:text-muted-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
					>Register</a>
				</nav>
			{/if}
		</div>
	</div>
</header>
