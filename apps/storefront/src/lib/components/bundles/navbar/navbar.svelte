<script lang="ts">
	import { page, navigating } from '$app/state';
	import * as Avatar from '$lib/components/bits/avatar';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';

	type Props = {
		customer?: {
			firstName: string;
			lastName: string;
			customFields?: { seller?: { customFields?: { slug?: string | null } } | null } | null;
		} | null;
	};

	let { customer = null }: Props = $props();

	/**
	 * The URL slug of the seller linked to the logged-in customer.
	 * null if not logged in or not a seller (e.g. a buyer-only account).
	 * Used to detect when the user is viewing their own sales page.
	 */
	const mySellerSlug = $derived(customer?.customFields?.seller?.customFields?.slug ?? null);

	/**
	 * The pathname we're navigating TO (if mid-navigation) or currently on.
	 * Uses the navigating target for instant visual feedback — the navbar
	 * updates as soon as a link is clicked, not after the page loads.
	 */
	const currentPathname = $derived(navigating.to?.url.pathname ?? page.url.pathname);

	/**
	 * Paths that are NOT seller slugs. Any first URL segment not in this set
	 * is treated as a seller slug (e.g. /gathering-together-farm).
	 */
	const reservedPaths = new Set([
		'me',
		'login',
		'register',
		'forgot-password',
		'reset-password',
		'verify',
		'verify-email-change'
	]);

	/** The current URL split into path segments, e.g. "/me/offers" → ["me", "offers"]. */
	const pathSegments = $derived(currentPathname.split('/').filter(Boolean));

	/** True when the URL starts with /me (dashboard pages like /me/offers, /me/account). */
	const isMe = $derived(pathSegments[0] === 'me');

	/**
	 * True when the first URL segment is a seller slug (not a reserved path).
	 * e.g. /gathering-together-farm → true, /login → false, /me/offers → false.
	 */
	const isSellerPage = $derived(
		pathSegments.length >= 1 && !reservedPaths.has(pathSegments[0])
	);

	/** True when on the marketplace home page (/). */
	const isHome = $derived(currentPathname === '/');

	/**
	 * True when the logged-in user is viewing their own seller's sales page.
	 * e.g. Joe (linked to gathering-together-farm) is on /gathering-together-farm.
	 * When true, the navbar shows "yay·me" instead of the seller slug.
	 */
	const isMySellerPage = $derived(isSellerPage && mySellerSlug != null && pathSegments[0] === mySellerSlug);

	/**
	 * Maps /me subpage segments to their display text in the navbar suffix.
	 * e.g. /me/offers → "my offers", /me/cart → "my cart".
	 * Pages not in this map (or /me itself) show "me".
	 */
	const meSubpageSuffixes: Record<string, string> = {
		offers: 'my offers',
		orders: 'my orders',
		sales: 'my sales',
		cart: 'my cart',
		account: 'my account'
	};

	/**
	 * The text shown after "yay·" in the navbar brand.
	 * - "me" when on /me root or viewing your own seller page
	 * - "my offers", "my cart", etc. when on /me subpages
	 * - the seller slug when viewing another seller's page
	 * - "csa" on the home page or other non-seller pages
	 */
	const navSuffix = $derived(
		isMySellerPage ? 'me'
		: isMe ? (meSubpageSuffixes[pathSegments[1]] ?? 'me')
		: isSellerPage ? pathSegments[0]
		: 'csa'
	);

	/**
	 * Where the suffix links to when clicked (only used when the suffix is NOT active).
	 * - /seller-slug when on a seller subpage
	 * - /me on the home page or other non-seller pages (go to become-a-seller or own sales page)
	 */
	const navSuffixHref = $derived(isSellerPage ? `/${pathSegments[0]}` : '/me');

	/**
	 * True when the suffix represents the current page context — meaning it should be
	 * bold and inert (not a link). True on:
	 * - all /me/* pages (each has its own suffix like "my offers")
	 * - a seller's root page (/gathering-together-farm)
	 */
	const isNavSuffixActive = $derived(
		isMe || (isSellerPage && pathSegments.length === 1)
	);

	/** Nav links for the buyer side (visible to all authenticated users). */
	const buyerLinks = [
		{ href: '/me/orders', label: 'Orders' }
	];

	/** Nav links for the seller side (only visible when the user is a seller). */
	const sellerLinks = [
		{ href: '/me/offers', label: 'Offers' },
		{ href: '/me/sales', label: 'Sales' }
	];

	/** Returns true if the current page is within the given nav link's path. */
	function isNavActive(href: string) {
		return currentPathname.startsWith(href);
	}

	const isLoginActive = $derived(currentPathname === '/login');
	const isRegisterActive = $derived(currentPathname === '/register');

	/** Two-letter initials for the user avatar (e.g. "JL" for Joe Lyman). */
	const initials = $derived(
		customer ? (customer.firstName?.[0] ?? '') + (customer.lastName?.[0] ?? '') : ''
	);
</script>

<header class="border-b">
	<div class="mx-auto max-w-5xl px-4 flex items-center justify-between py-4">
		<div class="flex items-center">
			<a
				href="/"
				class="text-lg font-bold transition-colors {isHome
					? 'text-foreground cursor-default'
					: 'text-muted-foreground/60 hover:text-muted-foreground'}"
			>yay</a>{#if isNavSuffixActive}<span
				class="text-lg font-bold text-foreground truncate max-w-48 sm:max-w-72"
			><span class="mx-1">&middot;</span>{navSuffix}</span>{:else}<a
				href={navSuffixHref}
				class="text-lg font-bold transition-colors truncate max-w-48 sm:max-w-72 text-muted-foreground/60 hover:text-muted-foreground"
			><span class="mx-1">&middot;</span>{navSuffix}</a>{/if}
		</div>
		<div class="flex items-center gap-4">
			{#if customer}
				<nav class="flex items-center gap-4">
					<a
						href="/me/cart"
						class="mr-1 transition-colors {currentPathname.startsWith('/me/cart')
							? 'text-foreground cursor-default'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>
						<ShoppingCart class="h-4 w-4" />
					</a>
					{#each buyerLinks as { href, label } (href)}
						<a
							{href}
							class="text-sm transition-colors {isNavActive(href)
								? 'text-foreground font-medium cursor-default'
								: 'text-muted-foreground/60 hover:text-muted-foreground'}"
						>
							{label}
						</a>
					{/each}
					{#if mySellerSlug}
						<span class="text-border">|</span>
						{#each sellerLinks as { href, label } (href)}
							<a
								{href}
								class="text-sm transition-colors {isNavActive(href)
									? 'text-foreground font-medium cursor-default'
									: 'text-muted-foreground/60 hover:text-muted-foreground'}"
							>
								{label}
							</a>
						{/each}
					{/if}
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
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>Log in</a>
					<a
						href="/register"
						class="text-sm transition-colors {isRegisterActive
							? 'text-foreground font-medium cursor-default'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>Register</a>
				</nav>
			{/if}
		</div>
	</div>
</header>
